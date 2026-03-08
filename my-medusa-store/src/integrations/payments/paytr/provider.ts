// ============================================================
// PayTR Payment Provider — Medusa V2
//
// Türkiye'nin popüler ödeme altyapısı — iFrame tabanlı.
// Tüm 3D Secure işlemleri iFrame içinde tamamlanır.
//
// API Dökümantasyonu: https://dev.paytr.com/
// Entegrasyon Tipi: iFrame API
//
// İleride bağımsız paket: medusa-plugin-payment-paytr
// ============================================================

import crypto from "crypto"
import { AbstractPaymentProvider, MedusaError } from "@medusajs/framework/utils"
import type {
  InitiatePaymentInput,
  InitiatePaymentOutput,
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  ProviderWebhookPayload,
  WebhookActionResult,
} from "@medusajs/framework/types"
import { BigNumber } from "@medusajs/framework/utils"
import type { PayTROptions, ThreeDSSessionData } from "../types"

// ─── PayTR API Tipleri ───────────────────────────────────────

interface PayTRTokenRequest {
  merchant_id: string
  user_ip: string
  merchant_oid: string
  email: string
  payment_amount: number  // Kuruş — örn. 1550 = 15.50 TL
  user_basket: string     // Base64 encoded JSON array
  no_installment: 0 | 1   // 0 = taksit açık, 1 = taksit kapalı
  max_installment: number // 0 = sınır yok, 2-12 = max taksit
  currency: "TL" | "USD" | "EUR" | "GBP"
  test_mode: 0 | 1
  // HMAC imzası
  paytr_token: string
  // Opsiyonel
  user_name?: string
  user_address?: string
  user_phone?: string
  merchant_ok_url?: string
  merchant_fail_url?: string
  sync_mode?: 0 | 1
  lang?: "tr" | "en"
  debug_on?: 0 | 1
}

interface PayTRTokenResponse {
  status: "success" | "failed"
  token?: string
  reason?: string
}

interface PayTRWebhookPayload {
  merchant_oid: string
  status: "success" | "failed"
  total_amount: string
  hash: string
  failed_reason_code?: string
  failed_reason_msg?: string
  test_mode?: string
  payment_type?: string
  currency?: string
  payment_amount?: string
}

// ─── Provider ───────────────────────────────────────────────

export class PayTRProvider extends AbstractPaymentProvider<PayTROptions> {
  static identifier = "paytr"

  private readonly merchantId: string
  private readonly merchantKey: string
  private readonly merchantSalt: string
  private readonly testMode: boolean

  constructor(container: Record<string, unknown>, options: PayTROptions) {
    super(container, options)
    this.merchantId = options.merchant_id
    this.merchantKey = options.merchant_key
    this.merchantSalt = options.merchant_salt
    this.testMode = options.test_mode ?? false
  }

  static validateOptions(options: Record<string, unknown>): void {
    for (const key of ["merchant_id", "merchant_key", "merchant_salt"]) {
      if (!options[key]) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, `PayTR: ${key} zorunludur.`)
      }
    }
  }

  // ─── HMAC İmzası ─────────────────────────────────────────

  /**
   * PayTR token HMAC hesaplar.
   * hash_str = merchant_id + user_ip + merchant_oid + email + payment_amount
   *           + no_installment + max_installment + currency + test_mode + merchant_salt
   */
  private buildTokenHash(fields: {
    user_ip: string
    merchant_oid: string
    email: string
    payment_amount: number
    no_installment: 0 | 1
    max_installment: number
    currency: string
    test_mode: 0 | 1
  }): string {
    const hashStr = [
      this.merchantId,
      fields.user_ip,
      fields.merchant_oid,
      fields.email,
      fields.payment_amount,
      fields.no_installment,
      fields.max_installment,
      fields.currency,
      fields.test_mode,
      this.merchantSalt,
    ].join("")

    return crypto
      .createHmac("sha256", this.merchantKey)
      .update(hashStr)
      .digest("base64")
  }

  /**
   * PayTR webhook hash doğrulaması.
   * hash = base64(HMAC-SHA256(merchant_oid + merchant_salt + status + total_amount, merchant_key))
   */
  private verifyWebhookHash(payload: PayTRWebhookPayload): boolean {
    const hashStr =
      payload.merchant_oid +
      this.merchantSalt +
      payload.status +
      payload.total_amount

    const expected = crypto
      .createHmac("sha256", this.merchantKey)
      .update(hashStr)
      .digest("base64")

    return expected === payload.hash
  }

  // ─── Yardımcılar ─────────────────────────────────────────

  private toSessionData(partial: Partial<ThreeDSSessionData>): Record<string, unknown> {
    return partial as Record<string, unknown>
  }

  private fromSessionData(data?: Record<string, unknown>): ThreeDSSessionData {
    return (data ?? {}) as unknown as ThreeDSSessionData
  }

  // ─── Medusa Metotları ─────────────────────────────────────

  /**
   * PayTR iFrame token oluşturur.
   * Dönen token ile storefront: https://www.paytr.com/odeme/guvenli/{token}
   * URL'ini iFrame'e yükler ve kullanıcı 3DS'i iFrame içinde tamamlar.
   */
  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const { amount, currency_code, context, data } = input
    const merchantOid = `po_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`
    const customer = context?.customer
    const amountInCents = typeof amount === "number" ? amount : Number(amount)

    const userIp = (data as any)?.ip ?? "127.0.0.1"
    const email = customer?.email ?? "musteri@example.com"
    const userName = `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() || "Müşteri"
    const installment = (data as any)?.card?.installment ?? 0
    const maxInstallment = installment > 0 ? installment : 12

    // Sepet bilgisi — PayTR base64 JSON array ister
    const basket = JSON.stringify([["Sipariş", (amountInCents / 100).toFixed(2), 1]])
    const userBasket = Buffer.from(basket).toString("base64")

    const currency = currency_code.toUpperCase() === "TRY" ? "TL" : "USD"
    const testModeVal = this.testMode ? 1 : 0

    const tokenHash = this.buildTokenHash({
      user_ip: userIp,
      merchant_oid: merchantOid,
      email,
      payment_amount: amountInCents,
      no_installment: installment > 0 ? 1 : 0,
      max_installment: maxInstallment,
      currency,
      test_mode: testModeVal,
    })

    const params = new URLSearchParams({
      merchant_id: this.merchantId,
      user_ip: userIp,
      merchant_oid: merchantOid,
      email,
      payment_amount: String(amountInCents),
      user_basket: userBasket,
      no_installment: String(installment > 0 ? 1 : 0),
      max_installment: String(maxInstallment),
      currency,
      test_mode: String(testModeVal),
      paytr_token: tokenHash,
      user_name: userName,
      user_address: customer?.billing_address?.address_1 ?? "Adres belirtilmedi",
      user_phone: customer?.phone ?? "",
      lang: "tr",
      debug_on: "0",
    })

    const response = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })

    const result = await response.json() as PayTRTokenResponse

    if (result.status === "failed") {
      return {
        id: merchantOid,
        data: this.toSessionData({
          session_id: merchantOid,
          status: "failed",
          error_message: result.reason,
        }),
      }
    }

    return {
      id: merchantOid,
      data: this.toSessionData({
        session_id: merchantOid,
        status: "pending_3ds",
        // Storefront bu URL'i iFrame'e yükler
        redirect_url: `https://www.paytr.com/odeme/guvenli/${result.token}`,
        provider_conversation_id: merchantOid,
        installment: installment || undefined,
      }),
    }
  }

  /**
   * PayTR webhook callback'ten ödeme sonucunu alır.
   * Webhook gelince session güncellenir; bu metod mevcut durumu döndürür.
   */
  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const session = this.fromSessionData(input.data)

    if (session.status === "authorized") {
      return { status: "authorized", data: input.data }
    }
    if (session.status === "failed") {
      return { status: "error", data: input.data }
    }

    return { status: "requires_more", data: input.data }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const session = this.fromSessionData(input.data)
    return {
      data: this.toSessionData({ ...session, status: "captured" }),
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const session = this.fromSessionData(input.data)
    return {
      data: this.toSessionData({ ...session, status: "canceled" }),
    }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const session = this.fromSessionData(input.data)
    const amountInCents = typeof input.amount === "number" ? input.amount : Number(input.amount)

    const merchantOid = session.provider_conversation_id ?? session.session_id
    if (!merchantOid) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "PayTR: İade için merchant_oid bulunamadı.")
    }

    const refundAmount = String(amountInCents)
    const hashStr = this.merchantId + merchantOid + refundAmount + this.merchantSalt
    const returnHash = crypto
      .createHmac("sha256", this.merchantKey)
      .update(hashStr)
      .digest("base64")

    const params = new URLSearchParams({
      merchant_id: this.merchantId,
      merchant_oid: merchantOid,
      return_amount: refundAmount,
      merchant_salt: this.merchantSalt,
      paytr_token: returnHash,
    })

    await fetch("https://www.paytr.com/odeme/iade", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    }).catch(() => {})

    return { data: input.data }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return { data: input.data }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: input.data }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const session = this.fromSessionData(input.data)

    switch (session.status) {
      case "authorized":
        return { status: "authorized" }
      case "captured":
        return { status: "captured" }
      case "canceled":
        return { status: "canceled" }
      case "failed":
        return { status: "error" }
      default:
        return { status: "pending" }
    }
  }

  /**
   * PayTR webhook işleme.
   * POST /hooks/payments/pp_paytr_paytr
   * PayTR; merchant_oid, status, total_amount ve hash gönderir.
   */
  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const body = payload.data as unknown as PayTRWebhookPayload

    if (!this.verifyWebhookHash(body)) {
      return { action: "failed", data: { session_id: "", amount: new BigNumber(0) } }
    }

    const sessionId = body.merchant_oid
    const amount = new BigNumber(Number(body.total_amount))

    if (body.status === "success") {
      return { action: "authorized", data: { session_id: sessionId, amount } }
    }

    return {
      action: "failed",
      data: { session_id: sessionId, amount: new BigNumber(0) },
    }
  }
}

export default PayTRProvider

// ============================================================
// PayU Payment Provider — Medusa V2
//
// Uluslararası ödeme sağlayıcısı — Türkiye operasyonu.
// REST API + 3D Secure redirect akışı.
//
// API Dökümantasyonu: https://developers.payu.com/
// Türkiye endpoint: https://secure.payu.com.tr
//
// İleride bağımsız paket: medusa-plugin-payment-payu
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
import type { PayUOptions, ThreeDSSessionData } from "../types"

// ─── PayU API Tipleri ─────────────────────────────────────

interface PayUOrderCreateRequest {
  notifyUrl: string
  customerIp: string
  merchantPosId: string
  description: string
  currencyCode: string
  totalAmount: string  // Kuruş (en küçük birim) — string olarak
  buyer?: {
    email: string
    firstName?: string
    lastName?: string
    phone?: string
    language?: string
  }
  products: Array<{
    name: string
    unitPrice: string
    quantity: string
  }>
  continueUrl?: string
}

interface PayUOrderCreateResponse {
  status: {
    statusCode: "SUCCESS" | "WARNING_CONTINUE_REDIRECT" | "ERROR"
    statusDesc?: string
  }
  orderId?: string
  redirectUri?: string
  extOrderId?: string
}

interface PayUOrderStatusResponse {
  status: {
    statusCode: "SUCCESS" | "ERROR"
  }
  orders?: Array<{
    orderId: string
    status: "NEW" | "PENDING" | "WAITING_FOR_CONFIRMATION" | "COMPLETED" | "CANCELED" | "REJECTED"
    totalAmount: string
    currencyCode: string
  }>
}

interface PayURefundRequest {
  refund: {
    description: string
    amount?: string  // Belirtilmezse tam iade
  }
}

interface PayUWebhookPayload {
  order?: {
    orderId: string
    extOrderId?: string
    orderCreateDate?: string
    notifyUrl?: string
    customerIp?: string
    merchantPosId?: string
    description?: string
    currencyCode?: string
    totalAmount?: string
    status?: "COMPLETED" | "PENDING" | "WAITING_FOR_CONFIRMATION" | "CANCELED" | "REJECTED"
  }
  localReceiptDateTime?: string
  properties?: Array<{ name: string; value: string }>
}

// ─── Provider ───────────────────────────────────────────────

export class PayUProvider extends AbstractPaymentProvider<PayUOptions> {
  static identifier = "payu"

  private readonly merchantId: string
  private readonly secretKey: string
  private readonly baseUrl: string
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(container: Record<string, unknown>, options: PayUOptions) {
    super(container, options)
    this.merchantId = options.merchant_id
    this.secretKey = options.secret_key
    this.baseUrl = options.base_url ?? "https://secure.payu.com.tr"
  }

  static validateOptions(options: Record<string, unknown>): void {
    for (const key of ["merchant_id", "secret_key"]) {
      if (!options[key]) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, `PayU: ${key} zorunludur.`)
      }
    }
  }

  // ─── OAuth Token ─────────────────────────────────────────

  /**
   * PayU OAuth2 client_credentials token alır.
   * Token 43200 saniye (12 saat) geçerlidir, önbellekte tutulur.
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.merchantId,
      client_secret: this.secretKey,
    })

    const response = await fetch(`${this.baseUrl}/pl/standard/user/oauth/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })

    const data = await response.json() as {
      access_token: string
      expires_in: number
    }

    this.accessToken = data.access_token
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
    return this.accessToken
  }

  // ─── HTTP İstekleri ──────────────────────────────────────

  private async apiRequest<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: object
  ): Promise<T> {
    const token = await this.getAccessToken()

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",  // PayU 302 redirect döndürür, takip etme
    })

    // PayU 302 redirect dönerse (ödeme sayfasına yönlendirme) JSON parse hata verir
    if (response.status === 302) {
      return { redirectUri: response.headers.get("location") } as unknown as T
    }

    return response.json() as Promise<T>
  }

  // ─── İmza Doğrulama ──────────────────────────────────────

  /**
   * PayU webhook OpenPayU-Signature header'ını doğrular.
   * Format: signature=...;algorithm=MD5
   */
  private verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string
  ): boolean {
    const parts = Object.fromEntries(
      signatureHeader.split(";").map((p) => p.split("="))
    )
    const expected = crypto
      .createHash("md5")
      .update(rawBody + this.secretKey)
      .digest("hex")
    return parts.signature === expected
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
   * PayU sipariş oluşturur.
   * Dönen redirect_url storefront'ta 3DS sayfasına yönlendirir.
   */
  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const { amount, currency_code, context, data } = input
    const customer = context?.customer
    const sessionId = `payu_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`
    const amountInCents = typeof amount === "number" ? amount : Number(amount)

    const orderRequest: PayUOrderCreateRequest = {
      notifyUrl: `${process.env.MEDUSA_BACKEND_URL ?? "http://localhost:7001"}/hooks/payments/pp_payu_payu`,
      customerIp: (data as any)?.ip ?? "127.0.0.1",
      merchantPosId: this.merchantId,
      description: `Sipariş ${sessionId}`,
      currencyCode: currency_code.toUpperCase(),
      totalAmount: String(amountInCents),
      buyer: customer
        ? {
            email: customer.email,
            firstName: customer.first_name ?? undefined,
            lastName: customer.last_name ?? undefined,
            phone: customer.phone ?? undefined,
            language: "tr",
          }
        : undefined,
      products: [
        {
          name: "Sipariş",
          unitPrice: String(amountInCents),
          quantity: "1",
        },
      ],
      continueUrl: (data as any)?.card?.callback_url,
    }

    const response = await this.apiRequest<PayUOrderCreateResponse>(
      "POST",
      "/api/v2_1/orders",
      orderRequest
    )

    const redirectUri =
      response.redirectUri ??
      (response as any).redirect_uri ??
      undefined

    if (response.status?.statusCode === "ERROR") {
      return {
        id: sessionId,
        data: this.toSessionData({
          session_id: sessionId,
          status: "failed",
          error_message: response.status.statusDesc,
        }),
      }
    }

    return {
      id: sessionId,
      data: this.toSessionData({
        session_id: sessionId,
        status: "pending_3ds",
        redirect_url: redirectUri,
        provider_payment_id: response.orderId,
        provider_conversation_id: sessionId,
      }),
    }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const session = this.fromSessionData(input.data)

    if (session.status === "authorized") {
      return { status: "authorized", data: input.data }
    }

    if (!session.provider_payment_id) {
      return { status: "requires_more", data: input.data }
    }

    // PayU sipariş durumunu sorgula
    const response = await this.apiRequest<PayUOrderStatusResponse>(
      "GET",
      `/api/v2_1/orders/${session.provider_payment_id}`
    ).catch(() => null)

    const order = response?.orders?.[0]
    if (!order) {
      return { status: "requires_more", data: input.data }
    }

    switch (order.status) {
      case "COMPLETED":
        return {
          status: "authorized",
          data: this.toSessionData({ ...session, status: "authorized" }),
        }
      case "CANCELED":
      case "REJECTED":
        return {
          status: "error",
          data: this.toSessionData({ ...session, status: "failed" }),
        }
      default:
        return { status: "requires_more", data: input.data }
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const session = this.fromSessionData(input.data)

    // PayU WAITING_FOR_CONFIRMATION durumundaki ödemeleri capture etmek için
    if (session.provider_payment_id) {
      await this.apiRequest(
        "POST",
        `/api/v2_1/orders/${session.provider_payment_id}/captures`,
        {}
      ).catch(() => {})
    }

    return {
      data: this.toSessionData({ ...session, status: "captured" }),
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const session = this.fromSessionData(input.data)

    if (session.provider_payment_id) {
      await this.apiRequest(
        "DELETE",
        `/api/v2_1/orders/${session.provider_payment_id}`
      ).catch(() => {})
    }

    return {
      data: this.toSessionData({ ...session, status: "canceled" }),
    }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input)
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const session = this.fromSessionData(input.data)
    const amountInCents = typeof input.amount === "number" ? input.amount : Number(input.amount)

    if (!session.provider_payment_id) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "PayU: İade için orderId bulunamadı.")
    }

    const refundBody: PayURefundRequest = {
      refund: {
        description: `İade - ${session.session_id}`,
        amount: String(amountInCents),
      },
    }

    await this.apiRequest(
      "POST",
      `/api/v2_1/orders/${session.provider_payment_id}/refunds`,
      refundBody
    ).catch(() => {})

    return { data: input.data }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const session = this.fromSessionData(input.data)
    if (!session.provider_payment_id) {
      return { data: input.data }
    }

    const response = await this.apiRequest<PayUOrderStatusResponse>(
      "GET",
      `/api/v2_1/orders/${session.provider_payment_id}`
    ).catch(() => null)

    const order = response?.orders?.[0]
    if (!order) return { data: input.data }

    const statusMap: Record<string, ThreeDSSessionData["status"]> = {
      COMPLETED: "captured",
      CANCELED: "canceled",
      REJECTED: "failed",
    }

    return {
      data: this.toSessionData({
        ...session,
        status: statusMap[order.status ?? ""] ?? session.status,
      }),
    }
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
   * PayU webhook işleme.
   * POST /hooks/payments/pp_payu_payu
   * Header: OpenPayU-Signature: signature=...;algorithm=MD5
   */
  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const { data, rawData, headers } = payload

    const signatureHeader = headers?.["openpayU-signature"] as string | undefined
    if (signatureHeader && rawData) {
      const rawBodyStr =
        typeof rawData === "string" ? rawData : Buffer.from(rawData as Buffer).toString("utf-8")

      if (!this.verifyWebhookSignature(rawBodyStr, signatureHeader)) {
        return { action: "failed", data: { session_id: "", amount: new BigNumber(0) } }
      }
    }

    const webhookData = data as unknown as PayUWebhookPayload
    const order = webhookData.order
    const sessionId = order?.extOrderId ?? ""
    const amount = new BigNumber(Number(order?.totalAmount ?? 0))

    switch (order?.status) {
      case "COMPLETED":
        return { action: "captured", data: { session_id: sessionId, amount } }

      case "WAITING_FOR_CONFIRMATION":
        return { action: "authorized", data: { session_id: sessionId, amount } }

      case "CANCELED":
      case "REJECTED":
        return { action: "failed", data: { session_id: sessionId, amount: new BigNumber(0) } }

      default:
        return { action: "not_supported", data: { session_id: sessionId, amount } }
    }
  }
}

export default PayUProvider

// ============================================================
// iyzico Payment Provider — Medusa V2
//
// Türkiye'nin en yaygın ödeme altyapısı.
// 3D Secure + Taksit destekler.
//
// API Dökümantasyonu: https://dev.iyzipay.com/
// Sandbox:  https://sandbox-api.iyzipay.com
// Prod:     https://api.iyzipay.com
//
// İleride bağımsız paket: medusa-plugin-payment-iyzico
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
import type { IyzicoOptions, ThreeDSInitData, ThreeDSSessionData } from "../types"

// ─── iyzico API Tipleri ──────────────────────────────────────

interface IyzicoAddress {
  contactName: string
  city: string
  country: string
  address: string
  zipCode?: string
}

interface IyzicoBuyer {
  id: string
  name: string
  surname: string
  gsmNumber?: string
  email: string
  identityNumber: string  // TC kimlik veya pasaport no
  registrationAddress: string
  ip: string
  city: string
  country: string
}

interface IyzicoBasketItem {
  id: string
  name: string
  category1: string
  itemType: "PHYSICAL" | "VIRTUAL"
  price: string  // Ondalıklı string — örn. "0.50"
}

interface IyzicoPaymentCard {
  cardHolderName: string
  cardNumber: string
  expireYear: string
  expireMonth: string
  cvc: string
  registerCard?: 0 | 1
}

interface IyzicoThreeDSInitRequest {
  locale: "tr" | "en"
  conversationId: string
  price: string
  paidPrice: string
  currency: "TRY" | "USD" | "EUR" | "GBP"
  installment: number
  paymentChannel: "WEB" | "MOBILE" | "MOBILE_WEB" | "MOBILE_IOS" | "MOBILE_ANDROID"
  paymentGroup: "PRODUCT" | "LISTING" | "SUBSCRIPTION"
  callbackUrl: string
  paymentCard: IyzicoPaymentCard
  buyer: IyzicoBuyer
  shippingAddress: IyzicoAddress
  billingAddress: IyzicoAddress
  basketItems: IyzicoBasketItem[]
}

interface IyzicoThreeDSInitResponse {
  status: "success" | "failure"
  locale: string
  systemTime: number
  conversationId: string
  errorCode?: string
  errorMessage?: string
  errorGroup?: string
  htmlContent?: string  // Base64 encoded HTML form
  paymentId?: string
}

interface IyzicoThreeDSAuthRequest {
  locale: "tr" | "en"
  conversationId: string
  paymentId: string
  conversationData?: string
}

interface IyzicoThreeDSAuthResponse {
  status: "success" | "failure"
  locale: string
  systemTime: number
  conversationId: string
  errorCode?: string
  errorMessage?: string
  paymentId?: string
  price?: string
  paidPrice?: string
  installment?: number
  paymentStatus?: string
  fraudStatus?: number
}

interface IyzicoRefundRequest {
  locale: "tr" | "en"
  conversationId: string
  paymentTransactionId: string
  price: string
  currency: "TRY" | "USD" | "EUR" | "GBP"
  ip: string
}

// ─── Provider ───────────────────────────────────────────────

export class IyzicoProvider extends AbstractPaymentProvider<IyzicoOptions> {
  static identifier = "iyzico"

  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly secretKey: string

  constructor(container: Record<string, unknown>, options: IyzicoOptions) {
    super(container, options)

    this.apiKey = options.api_key
    this.secretKey = options.secret_key
    this.baseUrl = options.sandbox
      ? "https://sandbox-api.iyzipay.com"
      : (options.base_url ?? "https://api.iyzipay.com")
  }

  static validateOptions(options: Record<string, unknown>): void {
    if (!options.api_key) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "iyzico: api_key zorunludur.")
    }
    if (!options.secret_key) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "iyzico: secret_key zorunludur.")
    }
  }

  // ─── HMAC İmzası ─────────────────────────────────────────

  /**
   * iyzico Authorization header oluşturur.
   * Format: IYZWSv2 apiKey={apiKey}&randomKey={randomKey}&signature={signature}
   * signature = base64(HMAC-SHA256(apiKey + randomKey + secretKey + requestBody))
   */
  private buildAuthorizationHeader(requestBody: string): string {
    const randomKey = crypto.randomBytes(12).toString("hex")
    const hashStr = this.apiKey + randomKey + this.secretKey + requestBody
    const signature = crypto
      .createHmac("sha256", this.secretKey)
      .update(hashStr)
      .digest("base64")

    return `IYZWSv2 apiKey=${this.apiKey}&randomKey=${randomKey}&signature=${signature}`
  }

  // ─── HTTP İstekleri ───────────────────────────────────────

  private async post<T>(path: string, body: object): Promise<T> {
    const bodyStr = JSON.stringify(body)
    const authorization = this.buildAuthorizationHeader(bodyStr)

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": authorization,
      },
      body: bodyStr,
    })

    const data = await response.json() as T
    return data
  }

  // ─── Yardımcılar ─────────────────────────────────────────

  /** Kuruş → iyzico ondalık string (örn. 12350 → "123.50") */
  private toIyzicoAmount(amountInCents: number): string {
    return (amountInCents / 100).toFixed(2)
  }

  private toSessionData(partial: Partial<ThreeDSSessionData>): Record<string, unknown> {
    return partial as Record<string, unknown>
  }

  private fromSessionData(data?: Record<string, unknown>): ThreeDSSessionData {
    return (data ?? {}) as unknown as ThreeDSSessionData
  }

  // ─── Medusa Metotları ─────────────────────────────────────

  /**
   * 3DS ödeme başlatır.
   * Storefront kart bilgilerini input.data içinde sağlamalı.
   * Dönen html_content storefront'ta render edilip banka 3DS sayfasına yönlendirir.
   */
  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const { amount, currency_code, context, data } = input
    const sessionId = `iyzico_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`

    const card = (data as any)?.card as ThreeDSInitData | undefined
    if (!card) {
      // Kart bilgisi yoksa session oluştur, kart bilgisi sonra gelecek
      return {
        id: sessionId,
        data: this.toSessionData({
          session_id: sessionId,
          status: "pending_3ds",
        }),
      }
    }

    const customer = context?.customer
    const amountInCents = typeof amount === "number" ? amount : Number(amount)
    const currency = currency_code.toUpperCase() as "TRY" | "USD" | "EUR" | "GBP"
    const installment = card.installment ?? 1
    const ip = (data as any)?.ip ?? "85.34.78.112"

    const requestBody: IyzicoThreeDSInitRequest = {
      locale: "tr",
      conversationId: sessionId,
      price: this.toIyzicoAmount(amountInCents),
      paidPrice: this.toIyzicoAmount(amountInCents),
      currency,
      installment,
      paymentChannel: "WEB",
      paymentGroup: "PRODUCT",
      callbackUrl: card.callback_url,
      paymentCard: {
        cardHolderName: card.card_holder_name,
        cardNumber: card.card_number,
        expireYear: card.expire_year,
        expireMonth: card.expire_month,
        cvc: card.cvc,
      },
      buyer: {
        id: customer?.id ?? "UNKNOWN",
        name: customer?.first_name ?? "Ad",
        surname: customer?.last_name ?? "Soyad",
        email: customer?.email ?? "musteri@example.com",
        identityNumber: (data as any)?.billing?.tc_no ?? "11111111111",
        gsmNumber: customer?.phone ?? undefined,
        registrationAddress: customer?.billing_address?.address_1 ?? "Adres belirtilmedi",
        ip,
        city: customer?.billing_address?.city ?? "Istanbul",
        country: customer?.billing_address?.country_code ?? "Turkey",
      },
      shippingAddress: {
        contactName: `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() || "Alıcı",
        city: customer?.billing_address?.city ?? "Istanbul",
        country: customer?.billing_address?.country_code ?? "Turkey",
        address: customer?.billing_address?.address_1 ?? "Adres belirtilmedi",
      },
      billingAddress: {
        contactName: `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() || "Alıcı",
        city: customer?.billing_address?.city ?? "Istanbul",
        country: customer?.billing_address?.country_code ?? "Turkey",
        address: customer?.billing_address?.address_1 ?? "Adres belirtilmedi",
      },
      basketItems: [
        {
          id: sessionId,
          name: "Sipariş",
          category1: "Genel",
          itemType: "PHYSICAL",
          price: this.toIyzicoAmount(amountInCents),
        },
      ],
    }

    const response = await this.post<IyzicoThreeDSInitResponse>(
      "/payment/3dsecure/initialize",
      requestBody
    )

    if (response.status === "failure") {
      return {
        id: sessionId,
        data: this.toSessionData({
          session_id: sessionId,
          status: "failed",
          error_message: response.errorMessage,
        }),
      }
    }

    const htmlContent = response.htmlContent
      ? Buffer.from(response.htmlContent, "base64").toString("utf-8")
      : undefined

    return {
      id: sessionId,
      data: this.toSessionData({
        session_id: sessionId,
        status: "pending_3ds",
        html_content: htmlContent,
        provider_payment_id: response.paymentId,
        provider_conversation_id: sessionId,
        installment,
      }),
    }
  }

  /**
   * 3DS sonrası iyzico'nun callback'ten gönderdiği paymentId ile ödemeyi tamamlar.
   * input.data içinde provider_payment_id bulunmalı.
   */
  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const session = this.fromSessionData(input.data)

    if (session.status === "authorized") {
      return { status: "authorized", data: input.data }
    }

    const paymentId = session.provider_payment_id
    if (!paymentId) {
      return {
        status: "requires_more",
        data: this.toSessionData({ ...session, status: "pending_3ds" }),
      }
    }

    const response = await this.post<IyzicoThreeDSAuthResponse>(
      "/payment/3dsecure/auth",
      {
        locale: "tr",
        conversationId: session.provider_conversation_id ?? session.session_id,
        paymentId,
      }
    )

    if (response.status === "failure") {
      return {
        status: "error",
        data: this.toSessionData({
          ...session,
          status: "failed",
          error_message: response.errorMessage,
        }),
      }
    }

    return {
      status: "authorized",
      data: this.toSessionData({
        ...session,
        status: "authorized",
        provider_payment_id: response.paymentId ?? paymentId,
        installment: response.installment,
      }),
    }
  }

  /**
   * iyzico 3DS'de ödeme auth ile birlikte capture olur.
   * Ayrı bir capture çağrısı gerekmez; mevcut durumu döndürür.
   */
  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const session = this.fromSessionData(input.data)
    return {
      data: this.toSessionData({ ...session, status: "captured" }),
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const session = this.fromSessionData(input.data)
    // iyzico iptal API'si: /payment/cancel
    // paymentId gerektirir
    if (session.provider_payment_id) {
      await this.post("/payment/cancel", {
        locale: "tr",
        conversationId: session.session_id,
        paymentId: session.provider_payment_id,
        ip: "127.0.0.1",
      }).catch(() => {}) // Sessizce başarısız ol
    }
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

    if (!session.provider_payment_id) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "iyzico: İade için paymentId bulunamadı.")
    }

    const refundRequest: IyzicoRefundRequest = {
      locale: "tr",
      conversationId: `refund_${session.session_id}_${Date.now()}`,
      paymentTransactionId: session.provider_payment_id,
      price: this.toIyzicoAmount(amountInCents),
      currency: "TRY",
      ip: "127.0.0.1",
    }

    await this.post("/payment/refund", refundRequest)

    return { data: input.data }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const session = this.fromSessionData(input.data)
    if (!session.provider_payment_id) {
      return { data: input.data }
    }

    const response = await this.post<{ status: string; paymentStatus?: string }>(
      "/payment/detail",
      {
        locale: "tr",
        conversationId: session.session_id,
        paymentId: session.provider_payment_id,
      }
    ).catch(() => null)

    return {
      data: this.toSessionData({
        ...session,
        status: response?.paymentStatus === "SUCCESS" ? "captured" : session.status,
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
      case "pending_3ds":
      default:
        return { status: "pending" }
    }
  }

  /**
   * iyzico webhook işleme.
   * POST /hooks/payments/pp_iyzico_iyzico
   * iyzico; token, status ve paymentId gönderir.
   */
  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const { data, headers } = payload

    // iyzico webhook imza doğrulaması
    const iyzicoSignature = headers?.["x-iyz-signature"] as string | undefined
    if (iyzicoSignature) {
      const expectedSignature = crypto
        .createHmac("sha256", this.secretKey)
        .update(JSON.stringify(data))
        .digest("hex")

      if (iyzicoSignature !== expectedSignature) {
        return { action: "failed", data: { session_id: "", amount: new BigNumber(0) } }
      }
    }

    const iyzicoData = data as {
      paymentId?: string
      status?: string
      iyziEventType?: string
      merchantData?: string
    }

    const sessionId = iyzicoData.merchantData ?? ""
    const amount = new BigNumber(0) // iyzico webhook tutarı içermez, DB'den alınmalı

    switch (iyzicoData.iyziEventType) {
      case "ADDRESS_PAYMENT.AUTHORIZED":
      case "AUTH":
        return { action: "authorized", data: { session_id: sessionId, amount } }

      case "ADDRESS_PAYMENT.CAPTURED":
      case "CAPTURE":
        return { action: "captured", data: { session_id: sessionId, amount } }

      case "ADDRESS_PAYMENT.FAILED":
      case "FAIL":
        return { action: "failed", data: { session_id: sessionId, amount } }

      default:
        return { action: "not_supported", data: { session_id: sessionId, amount } }
    }
  }
}

export default IyzicoProvider

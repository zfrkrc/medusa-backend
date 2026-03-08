// ============================================================
// Medusa Turkey — Payment Integration Types
//
// Türkiye'ye özgü ödeme tipleri.
// Medusa'nın AbstractPaymentProvider interface'ini extend eder.
//
// İleride bağımsız npm paketine dönüşebilir:
//   @medusa-tr/payment-types
// ============================================================

// ─── Taksit ─────────────────────────────────────────────────

export interface InstallmentOption {
  /** Taksit sayısı (1 = peşin) */
  count: number
  /** Taksit fiyat faktörü — örn. 1.08 = %8 faiz */
  price_factor: number
  /** Taksitli toplam tutar (kuruş) */
  total_amount: number
  /** Tek taksit tutarı (kuruş) */
  installment_price: number
}

export interface InstallmentInfo {
  /** Banka adı */
  bank_name: string
  /** Kart türü — örn. "MASTER_CARD", "VISA" */
  card_type: string
  /** Mevcut taksit seçenekleri */
  installment_prices: InstallmentOption[]
}

// ─── 3D Secure ───────────────────────────────────────────────

/**
 * `initiatePayment` data alanında storefront'tan gelen 3DS başlatma verisi.
 */
export interface ThreeDSInitData {
  /** Kart sahibi adı soyadı */
  card_holder_name: string
  /** Kart numarası */
  card_number: string
  /** Son kullanma yılı — örn. "2026" */
  expire_year: string
  /** Son kullanma ayı — örn. "12" */
  expire_month: string
  /** CVC / CVV */
  cvc: string
  /** Taksit sayısı (1 = peşin) */
  installment?: number
  /** 3DS tamamlandıktan sonra yönlendirilecek URL */
  callback_url: string
}

/**
 * `initiatePayment` döndürdüğü `data` içinde depolanan 3DS session bilgisi.
 * Storefront bu veriyi kullanarak 3DS formunu gösterir.
 */
export interface ThreeDSSessionData {
  /** Medusa payment session ID — provider'a gönderilir ve webhook'ta geri alınır */
  session_id: string
  /** 3DS durumu */
  status: "pending_3ds" | "authorized" | "captured" | "failed" | "canceled"
  /** Provider'ın döndürdüğü HTML form içeriği (iyzico) */
  html_content?: string
  /** Provider'ın döndürdüğü yönlendirme URL'i */
  redirect_url?: string
  /** Provider'a özgü payment/token ID'si */
  provider_payment_id?: string
  /** Provider'a özgü conversation/reference ID */
  provider_conversation_id?: string
  /** Seçilen taksit sayısı */
  installment?: number
  /** Hata mesajı */
  error_message?: string
}

// ─── Ödeme Bağlamı (Context) ──────────────────────────────

/**
 * initiatePayment.context.data olarak storefront'tan gelebilecek
 * Türkiye'ye özgü ek veriler.
 */
export interface TurkishPaymentContext {
  /** 3DS kart bilgileri */
  card?: ThreeDSInitData
  /** Fatura adresi (TC kimlik no bazı sağlayıcılar için zorunlu) */
  billing?: {
    first_name?: string
    last_name?: string
    address?: string
    city?: string
    country?: string
    zip_code?: string
    tc_no?: string
  }
  /** IP adresi — bazı sağlayıcılar zorunlu tutar */
  ip?: string
}

// ─── Provider Konfigürasyonu ─────────────────────────────

export interface IyzicoOptions {
  api_key: string
  secret_key: string
  /** Varsayılan: https://api.iyzipay.com */
  base_url?: string
  /** Test modu — varsayılan: false */
  sandbox?: boolean
}

export interface PayTROptions {
  merchant_id: string
  merchant_key: string
  merchant_salt: string
  /** Test modu — varsayılan: false */
  test_mode?: boolean
}

export interface PayUOptions {
  merchant_id: string
  secret_key: string
  /** Varsayılan: https://secure.payu.com.tr */
  base_url?: string
}

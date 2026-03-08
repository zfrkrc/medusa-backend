// ============================================================
// Medusa Turkey — Shipping Integration Types
//
// Bu dosya ileride bağımsız bir npm paketine taşınabilir:
//   @medusa-tr/shipping-types
//   veya medusa-plugin-shipping-core
// ============================================================

// ─── Adres ──────────────────────────────────────────────────

export interface TurkishAddress {
  /** İl adı — örn. "İstanbul" */
  province: string
  /** İlçe adı — örn. "Kadıköy" */
  district: string
  /** Mahalle adı — örn. "Moda Mahallesi" */
  neighborhood?: string
  /** Cadde / sokak / apartman açık adres satırı */
  address_line: string
  /** Posta kodu */
  postal_code?: string
}

// ─── Paket ──────────────────────────────────────────────────

export interface ShippingPackage {
  /** Ağırlık (kg) */
  weight: number
  /** Genişlik (cm) */
  width?: number
  /** Yükseklik (cm) */
  height?: number
  /** Uzunluk (cm) */
  length?: number
  /**
   * Desi (hacimsel ağırlık).
   * Türk kargo şirketlerinde standart hesaplama: (en × boy × yükseklik) / 3000
   * Sağlanmazsa sağlayıcı kendi hesaplar.
   */
  desi?: number
  /** Koli içeriği açıklaması */
  content?: string
  /** Sigorta değeri (kuruş) */
  insured_value?: number
}

// ─── Gönderi Tarafı ─────────────────────────────────────────

export interface ShippingParty {
  name: string
  phone: string
  email?: string
  address: TurkishAddress
  /** TC kimlik no — bazı sağlayıcılar zorunlu tutar */
  id_number?: string
}

// ─── Ödeme Tipi ─────────────────────────────────────────────

/** Kimin ödeyeceği */
export type ShippingPaymentType =
  | "sender"     // Gönderici öder
  | "recipient"  // Alıcı öder
  | "cod"        // Kapıda ödeme (Kapıda Teslim)

// ─── Gönderi Oluşturma ───────────────────────────────────────

export interface CreateShipmentInput {
  /** Medusa order ID — referans için */
  order_id: string
  /** Kargo müşteri referans numarası */
  reference_no?: string

  sender: ShippingParty
  recipient: ShippingParty

  packages: ShippingPackage[]

  /** Servis tipi — örn. "standard", "express", "same_day" */
  service_type?: string
  /** Ödeme tipi */
  payment_type?: ShippingPaymentType
  /**
   * Kapıda ödeme tutarı (kuruş).
   * payment_type = "cod" ise zorunlu.
   */
  cod_amount?: number

  /** Gönderi notu */
  notes?: string
  /** Planlanan teslim tarihi */
  scheduled_delivery?: Date
}

export interface ShipmentResult {
  /** Sağlayıcının döndürdüğü gönderi ID'si */
  shipment_id: string
  /** Takip numarası / barkod */
  tracking_number: string
  /** Takip URL'i */
  tracking_url?: string
  /** Etiket URL'i veya base64 içeriği */
  label_url?: string
  /** Tahmini teslimat tarihi */
  estimated_delivery?: Date
  /** Sağlayıcıdan gelen ham yanıt (debug / log için) */
  raw?: Record<string, unknown>
}

export interface CancelShipmentResult {
  success: boolean
  message?: string
}

// ─── Takip ──────────────────────────────────────────────────

export type TrackingStatus =
  | "created"           // Gönderi oluşturuldu
  | "picked_up"         // Kargoya verildi
  | "in_transit"        // Yolda
  | "out_for_delivery"  // Dağıtımda
  | "delivered"         // Teslim edildi
  | "failed_delivery"   // Teslim başarısız
  | "returned"          // İade edildi
  | "cancelled"         // İptal edildi

export interface TrackingEvent {
  timestamp: Date
  status: TrackingStatus
  description: string
  location?: string
}

export interface TrackingInfo {
  tracking_number: string
  status: TrackingStatus
  events: TrackingEvent[]
  estimated_delivery?: Date
  /** Teslim edilmişse teslim tarihi */
  delivered_at?: Date
}

// ─── Etiket ─────────────────────────────────────────────────

export interface LabelResult {
  format: "pdf" | "zpl" | "png"
  /** Binary data (PDF/PNG) veya ZPL text */
  data: Buffer | string
  /** Sağlayıcı etiket URL'i sağlıyorsa */
  url?: string
}

// ─── Fiyat Hesaplama ─────────────────────────────────────────

export interface RateCalculationInput {
  origin: TurkishAddress
  destination: TurkishAddress
  packages: ShippingPackage[]
  service_type?: string
}

export interface RateResult {
  /** Hangi sağlayıcıdan geldiği */
  provider: string
  service_type: string
  /** Fiyat (kuruş) */
  rate: number
  currency: "TRY"
  /** Tahmini teslimat süresi (iş günü) */
  estimated_days: number
}

// ─── Ana Interface ────────────────────────────────────────────

/**
 * Tüm kargo sağlayıcılarının uygulaması gereken arayüz.
 *
 * Her provider bu interface'i implemente eder ve
 * ShippingModuleService'e register edilir.
 *
 * İleride bağımsız paket: medusa-plugin-shipping-{provider}
 */
export interface ShippingProvider {
  /** Tekil sağlayıcı kimliği — örn. "yurtici", "aras", "mng" */
  readonly identifier: string

  /** Yeni gönderi oluştur */
  createShipment(input: CreateShipmentInput): Promise<ShipmentResult>

  /** Gönderiyi iptal et */
  cancelShipment(shipmentId: string): Promise<CancelShipmentResult>

  /** Takip bilgisini getir */
  getTracking(trackingNumber: string): Promise<TrackingInfo>

  /** Kargo etiketi oluştur / getir */
  createLabel(shipmentId: string): Promise<LabelResult>

  /**
   * Fiyat hesapla (opsiyonel).
   * Destekleyen sağlayıcılar için çoklu seçenek sunar.
   */
  calculateRate?(input: RateCalculationInput): Promise<RateResult[]>
}

// ─── Servis Konfigürasyonu ───────────────────────────────────

export interface ShippingProviderConfig {
  /** Provider identifier — örn. "yurtici" */
  identifier: string
  /** Provider'a özgü ayarlar (API key, account no vb.) */
  options: Record<string, unknown>
}

export interface ShippingModuleOptions {
  /** Aktif sağlayıcılar ve konfigürasyonları */
  providers?: ShippingProviderConfig[]
  /** Varsayılan sağlayıcı — belirtilmezse ilk kayıtlı kullanılır */
  default_provider?: string
}

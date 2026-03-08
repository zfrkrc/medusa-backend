// ============================================================
// Medusa Turkey — Invoicing Integration Types
//
// e-Fatura / e-Arşiv sistemi için tip tanımları.
// Paraşüt API temel alınmış; diğer sağlayıcılar için extend edilebilir.
//
// İleride bağımsız paket: medusa-plugin-invoice-parasut
// ============================================================

// ─── Fatura Durumu ──────────────────────────────────────────

export type InvoiceStatus =
  | "draft"      // Taslak — henüz kesilmedi
  | "issued"     // Kesildi
  | "cancelled"  // İptal edildi

export type InvoiceType =
  | "earchive"   // e-Arşiv (B2C)
  | "einvoice"   // e-Fatura (B2B — kayıtlı mükellef)

// ─── Müşteri Bilgisi ─────────────────────────────────────────

export interface InvoiceContact {
  name: string
  email?: string
  phone?: string
  address?: string
  city?: string
  district?: string
  /** TC kimlik numarası (bireysel) */
  id_number?: string
  /** Vergi kimlik numarası (kurumsal) */
  tax_number?: string
  /** Vergi dairesi */
  tax_office?: string
  /** Kurumsal fatura için şirket adı */
  company_name?: string
  /** Hesap tipi: bireysel ya da kurumsal */
  account_type?: "person" | "company"
}

// ─── Fatura Kalemi ──────────────────────────────────────────

export interface InvoiceLineItem {
  /** Ürün/hizmet adı */
  name: string
  /** Adet */
  quantity: number
  /** Birim fiyat (kuruş) */
  unit_price: number
  /** KDV oranı — 0, 1, 8, 10, 18, 20 */
  vat_rate: number
  /** Ürün birimi — örn. "Adet", "Kg", "Hizmet" */
  unit?: string
  /** İndirim yüzdesi */
  discount_percentage?: number
  /** Paraşüt ürün ID'si (varsa) */
  provider_product_id?: string
}

// ─── Fatura Oluşturma ────────────────────────────────────────

export interface CreateInvoiceInput {
  order_id: string
  invoice_type: InvoiceType
  contact: InvoiceContact
  line_items: InvoiceLineItem[]
  currency?: string
  notes?: string
  /** Fatura serisi — örn. "A", "B" */
  invoice_series?: string
  /** Sipariş tarihi (varsayılan: bugün) */
  issue_date?: string
}

export interface CreateInvoiceOutput {
  invoice_id: string
  provider_invoice_id: string
  invoice_number?: string
  status: InvoiceStatus
  invoice_type: InvoiceType
  pdf_url?: string
  issued_at?: Date
}

// ─── Fatura Provider Interface ──────────────────────────────

export interface InvoiceProvider {
  readonly identifier: string

  /** Fatura oluştur ve kes */
  createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceOutput>

  /** Faturayı iptal et */
  cancelInvoice(providerInvoiceId: string): Promise<void>

  /** PDF binary döndür */
  getPdf(providerInvoiceId: string): Promise<Buffer>

  /** Fatura durumunu sorgula */
  getStatus(providerInvoiceId: string): Promise<InvoiceStatus>
}

// ─── Provider Konfigürasyonu ─────────────────────────────────

export interface ParasutOptions {
  /** OAuth client ID */
  client_id: string
  /** OAuth client secret */
  client_secret: string
  /** OAuth kullanıcı e-postası */
  username: string
  /** OAuth kullanıcı şifresi */
  password: string
  /** Paraşüt şirket ID'si */
  company_id: string
  /** Varsayılan: https://api.parasut.com */
  base_url?: string
  /** Sandbox modu */
  sandbox?: boolean
}

export interface InvoicingModuleOptions {
  /** Aktif provider — örn. "parasut" */
  provider?: string
  /** Paraşüt provider konfigürasyonu */
  parasut?: ParasutOptions
  /** Varsayılan fatura tipi */
  default_invoice_type?: InvoiceType
  /** Varsayılan KDV oranı */
  default_vat_rate?: number
  /** Fatura kesimi etkin mi? */
  enabled?: boolean
}

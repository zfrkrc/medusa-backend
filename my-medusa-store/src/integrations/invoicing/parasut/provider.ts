// ============================================================
// Paraşüt Invoice Provider
//
// Paraşüt muhasebe yazılımı üzerinden e-Arşiv / e-Fatura kesme.
// JSON:API formatı kullanır (https://jsonapi.org/).
//
// API Dökümantasyonu: https://apidocs.parasut.com/
// Sandbox: https://api.parasut.com (test company ile)
//
// İleride bağımsız paket: medusa-plugin-invoice-parasut
// ============================================================

import type {
  InvoiceProvider,
  InvoiceStatus,
  CreateInvoiceInput,
  CreateInvoiceOutput,
  ParasutOptions,
  InvoiceLineItem,
  InvoiceContact,
} from "../types"

// ─── Paraşüt JSON:API Tipleri ────────────────────────────────

interface ParasutTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
}

interface JsonApiResource {
  id?: string
  type: string
  attributes?: Record<string, unknown>
  relationships?: Record<string, { data: { type: string; id: string } | Array<{ type: string; id?: string; attributes?: Record<string, unknown>; relationships?: Record<string, unknown> }> }>
}

interface JsonApiResponse<T = JsonApiResource> {
  data?: T
  errors?: Array<{ title: string; detail?: string }>
  meta?: Record<string, unknown>
}

// ─── Provider ───────────────────────────────────────────────

export class ParasutProvider implements InvoiceProvider {
  readonly identifier = "parasut"

  private readonly baseUrl: string
  private readonly companyId: string
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly username: string
  private readonly password: string

  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(options: ParasutOptions) {
    this.baseUrl   = options.base_url ?? "https://api.parasut.com"
    this.companyId = options.company_id
    this.clientId  = options.client_id
    this.clientSecret = options.client_secret
    this.username  = options.username
    this.password  = options.password
  }

  // ─── OAuth2 Token ─────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    const params = new URLSearchParams({
      grant_type:    "password",
      client_id:     this.clientId,
      client_secret: this.clientSecret,
      username:      this.username,
      password:      this.password,
      redirect_uri:  "urn:ietf:wg:oauth:2.0:oob",
    })

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    params.toString(),
    })

    if (!response.ok) {
      throw new Error(`Paraşüt OAuth hatası: ${response.status}`)
    }

    const data = await response.json() as ParasutTokenResponse
    this.accessToken = data.access_token
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
    return this.accessToken
  }

  // ─── HTTP İstekleri ───────────────────────────────────────

  private get apiBase(): string {
    return `${this.baseUrl}/v4/${this.companyId}`
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: object
  ): Promise<T> {
    const token = await this.getAccessToken()

    const response = await fetch(`${this.apiBase}${path}`, {
      method,
      headers: {
        "Content-Type": "application/vnd.api+json",
        "Accept":       "application/vnd.api+json",
        "Authorization": `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => "")
      throw new Error(`Paraşüt API ${method} ${path} → ${response.status}: ${errText}`)
    }

    // DELETE 204 No Content döndürür
    if (response.status === 204) return {} as T

    return response.json() as Promise<T>
  }

  // ─── Yardımcılar ─────────────────────────────────────────

  /** Kuruş → TL string (örn. 12350 → "123.5") */
  private toCurrencyStr(cents: number): string {
    return (cents / 100).toString()
  }

  /** Müşteri için Paraşüt contact oluştur veya bul */
  private async resolveContact(contact: InvoiceContact): Promise<string> {
    // Önce e-posta ile ara
    if (contact.email) {
      const searchResp = await this.request<JsonApiResponse<JsonApiResource[]>>(
        "GET",
        `/contacts?filter[email]=${encodeURIComponent(contact.email)}`
      ).catch(() => null)

      const existing = searchResp?.data?.[0]
      if (existing?.id) return existing.id
    }

    // Bulunamazsa yeni contact oluştur
    const isCompany = contact.account_type === "company" || !!contact.company_name
    const createResp = await this.request<JsonApiResponse<JsonApiResource>>(
      "POST",
      "/contacts",
      {
        data: {
          type: "contacts",
          attributes: {
            account_type:      isCompany ? "company" : "person",
            name:              contact.company_name ?? contact.name,
            email:             contact.email,
            phone:             contact.phone,
            address:           contact.address,
            city:              contact.city,
            district:          contact.district,
            tax_number:        contact.tax_number ?? contact.id_number,
            tax_office:        contact.tax_office,
            is_abroad:         false,
          },
        },
      }
    )

    const id = createResp?.data?.id
    if (!id) throw new Error("Paraşüt: Contact oluşturulamadı.")
    return id
  }

  /** Ürün listesini JSON:API included formatına çevirir */
  private buildDetailsIncluded(
    items: InvoiceLineItem[]
  ): Array<Record<string, unknown>> {
    return items.map((item, idx) => ({
      type: "sales_invoice_details",
      attributes: {
        quantity:             item.quantity,
        unit_price:           this.toCurrencyStr(item.unit_price),
        vat_rate:             item.vat_rate,
        description:          item.name,
        unit:                 item.unit ?? "Adet",
        discount_type:        item.discount_percentage ? "percentage" : null,
        discount_value:       item.discount_percentage ?? 0,
      },
      ...(item.provider_product_id
        ? {
            relationships: {
              product: {
                data: { type: "products", id: item.provider_product_id },
              },
            },
          }
        : {}),
    }))
  }

  // ─── Ana Metotlar ─────────────────────────────────────────

  async createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
    const {
      order_id,
      invoice_type,
      contact: contactInfo,
      line_items,
      currency = "TRY",
      notes,
      invoice_series = "A",
      issue_date = new Date().toISOString().split("T")[0],
    } = input

    // 1. Contact oluştur/bul
    const contactId = await this.resolveContact(contactInfo)

    // 2. Fatura oluştur
    const detailsData = this.buildDetailsIncluded(line_items)

    const invoiceBody = {
      data: {
        type: "sales_invoices",
        attributes: {
          item_type:              "invoice",
          invoice_series,
          issue_date,
          due_date:               issue_date,
          currency,
          exchange_rate:          1,
          order_no:               order_id,
          order_date:             issue_date,
          is_abroad:              false,
          invoice_discount_type:  "percentage",
          invoice_discount:       0,
          description:            notes ?? `Sipariş: ${order_id}`,
        },
        relationships: {
          contact: {
            data: { type: "contacts", id: contactId },
          },
          details: {
            data: detailsData,
          },
        },
      },
    }

    const createResp = await this.request<JsonApiResponse<JsonApiResource>>(
      "POST",
      "/sales_invoices",
      invoiceBody
    )

    const invoiceId = createResp?.data?.id
    if (!invoiceId) throw new Error("Paraşüt: Fatura oluşturulamadı.")

    const attrs = createResp?.data?.attributes as Record<string, unknown> ?? {}

    // 3. e-Arşiv veya e-Fatura olarak kes
    const issueEndpoint =
      invoice_type === "einvoice"
        ? `/sales_invoices/${invoiceId}/issue_einvoice?include=pdf`
        : `/sales_invoices/${invoiceId}/issue_earchive?include=pdf`

    const issueResp = await this.request<JsonApiResponse<JsonApiResource>>(
      "POST",
      issueEndpoint,
      {
        data: {
          type:       invoice_type === "einvoice" ? "issue_einvoice" : "issue_earchive",
          id:         invoiceId,
          attributes: {
            send_email: false,
          },
        },
      }
    ).catch((err) => {
      console.error(`[invoicing] Paraşüt ${issueEndpoint} hatası:`, err.message)
      return null
    })

    const issueAttrs = issueResp?.data?.attributes as Record<string, unknown> ?? {}

    return {
      invoice_id:          `inv_${order_id}_${Date.now()}`,
      provider_invoice_id: invoiceId,
      invoice_number:      (attrs.invoice_no ?? issueAttrs.invoice_no ?? "") as string,
      status:              issueResp ? "issued" : "draft",
      invoice_type,
      pdf_url:             (issueAttrs.url ?? attrs.url ?? "") as string | undefined,
      issued_at:           issueResp ? new Date() : undefined,
    }
  }

  async cancelInvoice(providerInvoiceId: string): Promise<void> {
    await this.request(
      "DELETE",
      `/sales_invoices/${providerInvoiceId}`
    )
  }

  async getPdf(providerInvoiceId: string): Promise<Buffer> {
    const token = await this.getAccessToken()

    const response = await fetch(
      `${this.apiBase}/sales_invoices/${providerInvoiceId}/pdf`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/pdf",
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Paraşüt: PDF alınamadı (${response.status})`)
    }

    return Buffer.from(await response.arrayBuffer())
  }

  async getStatus(providerInvoiceId: string): Promise<InvoiceStatus> {
    const resp = await this.request<JsonApiResponse<JsonApiResource>>(
      "GET",
      `/sales_invoices/${providerInvoiceId}`
    )

    const attrs = resp?.data?.attributes as Record<string, unknown> ?? {}
    const status = (attrs.status as string) ?? ""

    if (status === "paid" || status === "approved") return "issued"
    if (status === "cancelled") return "cancelled"
    return "draft"
  }
}

export default ParasutProvider

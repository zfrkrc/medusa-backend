import { MedusaService } from "@medusajs/framework/utils"
import Invoice from "./models/invoice"
import type { InvoiceProvider, InvoicingModuleOptions } from "../../integrations/invoicing/types"
import { ParasutProvider } from "../../integrations/invoicing/parasut/provider"

const InvoicingBase = MedusaService({ Invoice })

class InvoicingModuleService extends InvoicingBase {
  private providers = new Map<string, InvoiceProvider>()

  constructor(container: Record<string, unknown>, options?: InvoicingModuleOptions) {
    super(container, options as any)

    // Paraşüt provider'ı options'tan otomatik başlat
    if (options?.provider === "parasut" && options.parasut) {
      this.registerProvider(new ParasutProvider(options.parasut))
    }
  }

  // ─── Provider Registry ──────────────────────────────────

  registerProvider(provider: InvoiceProvider): void {
    this.providers.set(provider.identifier, provider)
  }

  getProvider(identifier: string): InvoiceProvider {
    const p = this.providers.get(identifier)
    if (!p) throw new Error(`Invoicing: Provider "${identifier}" bulunamadı.`)
    return p
  }

  listProviderIds(): string[] {
    return [...this.providers.keys()]
  }

  // ─── Fatura Kaydet ──────────────────────────────────────

  async saveInvoice(data: {
    order_id: string
    provider: string
    provider_invoice_id?: string
    invoice_number?: string
    invoice_type: string
    status: string
    amount?: number
    currency?: string
    pdf_url?: string
    issued_at?: Date
    error_message?: string
  }) {
    return this.createInvoices(data as any)
  }

  async updateInvoiceStatus(id: string, status: string, extra?: {
    pdf_url?: string
    issued_at?: Date
    error_message?: string
  }) {
    return this.updateInvoices({ id }, { status, ...extra } as any)
  }

  // ─── Listele / Bul ─────────────────────────────────────

  async listByOrder(orderId: string) {
    return this.listInvoices({ order_id: orderId } as any)
  }

  async findById(id: string) {
    const [inv] = await this.listInvoices({ id } as any)
    return inv ?? null
  }

  // ─── PDF ────────────────────────────────────────────────

  async fetchPdf(id: string): Promise<Buffer> {
    const inv = await this.findById(id)
    if (!inv) throw new Error(`Invoice not found: ${id}`)
    if (!inv.provider_invoice_id) throw new Error("provider_invoice_id yok")

    const provider = this.getProvider(inv.provider)
    return provider.getPdf(inv.provider_invoice_id)
  }

  // ─── İptal ──────────────────────────────────────────────

  async cancelById(id: string): Promise<void> {
    const inv = await this.findById(id)
    if (!inv) throw new Error(`Invoice not found: ${id}`)
    if (!inv.provider_invoice_id) return

    const provider = this.getProvider(inv.provider)
    await provider.cancelInvoice(inv.provider_invoice_id)
    await this.updateInvoiceStatus(id, "cancelled")
  }
}

export default InvoicingModuleService

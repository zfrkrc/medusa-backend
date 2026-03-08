// ============================================================
// Fatura Oluşturma Workflow — Medusa V2
//
// order.completed → bu workflow tetiklenir.
// Adımlar:
//   1. Siparişi çek (order + items + customer)
//   2. Fatura oluştur (provider)
//   3. Yerel DB'ye kaydet
// ============================================================

import {
  createStep,
  createWorkflow,
  transform,
  WorkflowResponse,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { INVOICING_MODULE } from "../modules/invoicing"
import type InvoicingModuleService from "../modules/invoicing/service"
import type { CreateInvoiceInput } from "../integrations/invoicing/types"

// ─── Input ────────────────────────────────────────────────

export interface CreateInvoiceWorkflowInput {
  order_id: string
  /** Provider identifier — varsayılan: "parasut" */
  provider?: string
  /** e-Arşiv mi e-Fatura mı? — varsayılan: "earchive" */
  invoice_type?: "earchive" | "einvoice"
}

// ─── Adım 1: Siparişi çek ─────────────────────────────────

const fetchOrderStep = createStep(
  "fetch-order-step",
  async (input: { order_id: string }, { container }) => {
    const query = container.resolve("query") as any

    const { data: orders } = await query.graph({
      entity: "order",
      filters: { id: input.order_id },
      fields: [
        "id",
        "display_id",
        "currency_code",
        "total",
        "subtotal",
        "tax_total",
        "email",
        "customer.*",
        "billing_address.*",
        "shipping_address.*",
        "items.*",
        "items.tax_lines.*",
      ],
    })

    const order = orders?.[0]
    if (!order) throw new Error(`Sipariş bulunamadı: ${input.order_id}`)

    return new StepResponse(order)
  }
)

// ─── Adım 2: Fatura oluştur ───────────────────────────────

const createInvoiceStep = createStep(
  "create-invoice-step",
  async (
    input: {
      order: any
      provider: string
      invoice_type: "earchive" | "einvoice"
    },
    { container }
  ) => {
    const invoicingSvc = container.resolve(INVOICING_MODULE) as InvoicingModuleService
    const provider = invoicingSvc.getProvider(input.provider)

    const { order, invoice_type } = input
    const billing = order.billing_address ?? order.shipping_address ?? {}
    const customer = order.customer ?? {}

    // ─── Contact bilgisi
    const contact = {
      name: billing.first_name
        ? `${billing.first_name} ${billing.last_name ?? ""}`.trim()
        : customer.first_name
          ? `${customer.first_name} ${customer.last_name ?? ""}`.trim()
          : "Müşteri",
      email: order.email ?? customer.email,
      phone: billing.phone ?? customer.phone,
      address: [billing.address_1, billing.address_2].filter(Boolean).join(" "),
      city: billing.city,
      district: billing.province,
      tax_number: billing.metadata?.tax_number as string | undefined,
      tax_office: billing.metadata?.tax_office as string | undefined,
      company_name: billing.company,
      account_type: billing.company ? ("company" as const) : ("person" as const),
    }

    // ─── Sipariş kalemleri
    const line_items = (order.items ?? []).map((item: any) => {
      const taxRate = item.tax_lines?.[0]?.rate ?? 20
      return {
        name: item.title ?? item.variant_title ?? "Ürün",
        quantity: item.quantity,
        unit_price: Math.round(item.unit_price),  // zaten kuruş
        vat_rate: taxRate,
        unit: "Adet",
      }
    })

    const invoiceInput: CreateInvoiceInput = {
      order_id: order.id,
      invoice_type,
      contact,
      line_items,
      currency: order.currency_code?.toUpperCase() ?? "TRY",
      notes: `Sipariş #${order.display_id ?? order.id}`,
    }

    const result = await provider.createInvoice(invoiceInput)
    // Compensation için hem invoice ID hem provider ID'yi sakla
    return new StepResponse(result, {
      provider_invoice_id: result.provider_invoice_id,
      provider: input.provider,
    })
  },
  // Compensation: oluşturulan faturayı iptal et
  // İmza: (compensateInput, context) — sadece 2 parametre
  async (
    saved: { provider_invoice_id?: string; provider: string } | undefined,
    { container }: { container: any }
  ) => {
    if (!saved?.provider_invoice_id) return
    try {
      const invoicingSvc = container.resolve(INVOICING_MODULE) as InvoicingModuleService
      const prov = invoicingSvc.getProvider(saved.provider)
      await prov.cancelInvoice(saved.provider_invoice_id)
    } catch (_) { /* ignore */ }
  }
)

// ─── Adım 3: DB'ye kaydet ─────────────────────────────────

const saveInvoiceStep = createStep(
  "save-invoice-step",
  async (
    input: {
      order: any
      invoice_result: any
      provider: string
      invoice_type: "earchive" | "einvoice"
    },
    { container }
  ) => {
    const invoicingSvc = container.resolve(INVOICING_MODULE) as InvoicingModuleService
    const { order, invoice_result, provider, invoice_type } = input

    const saved = await invoicingSvc.saveInvoice({
      order_id:             order.id,
      provider,
      provider_invoice_id:  invoice_result.provider_invoice_id,
      invoice_number:       invoice_result.invoice_number,
      invoice_type,
      status:               invoice_result.status,
      amount:               order.total,
      currency:             order.currency_code,
      pdf_url:              invoice_result.pdf_url,
      issued_at:            invoice_result.issued_at,
    })

    return new StepResponse(saved)
  }
)

// ─── Workflow ─────────────────────────────────────────────

export const createInvoiceWorkflow = createWorkflow(
  "create-invoice-workflow",
  (input: CreateInvoiceWorkflowInput) => {
    // transform: workflow context'te ?? ve tip dönüşümü için gerekli
    const resolved = transform(input, (data) => ({
      order_id:     data.order_id,
      provider:     data.provider ?? "parasut",
      invoice_type: (data.invoice_type ?? "earchive") as "earchive" | "einvoice",
    }))

    const order          = fetchOrderStep({ order_id: resolved.order_id })
    const invoice_result = createInvoiceStep({
      order,
      provider:     resolved.provider,
      invoice_type: resolved.invoice_type,
    })
    const saved = saveInvoiceStep({
      order,
      invoice_result,
      provider:     resolved.provider,
      invoice_type: resolved.invoice_type,
    })

    return new WorkflowResponse(saved)
  }
)

export default createInvoiceWorkflow

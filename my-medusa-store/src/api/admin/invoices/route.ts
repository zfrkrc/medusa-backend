// GET  /admin/invoices          — fatura listesi
// POST /admin/invoices          — manuel fatura oluştur
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INVOICING_MODULE } from "../../../modules/invoicing"
import type InvoicingModuleService from "../../../modules/invoicing/service"
import { createInvoiceWorkflow } from "../../../workflows/create-invoice"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const invoicingSvc = req.scope.resolve(INVOICING_MODULE) as InvoicingModuleService

    const {
      order_id,
      status,
      limit = "20",
      offset = "0",
    } = req.query as Record<string, string>

    const filters: any = {}
    if (order_id) filters.order_id = order_id
    if (status)   filters.status   = status

    const [invoices, count] = await invoicingSvc.listAndCountInvoices(filters, {
      take: Number(limit),
      skip: Number(offset),
      order: { created_at: "DESC" },
    } as any)

    res.json({ invoices, count, limit: Number(limit), offset: Number(offset) })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const {
      order_id,
      provider = process.env.INVOICE_PROVIDER ?? "parasut",
      invoice_type = "earchive",
    } = req.body as any

    if (!order_id) {
      return res.status(400).json({ error: "order_id zorunludur." })
    }

    const result = await createInvoiceWorkflow(req.scope).run({
      input: {
        order_id,
        provider,
        invoice_type: invoice_type as "earchive" | "einvoice",
      },
    })

    res.status(201).json({ invoice: result.result })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
}

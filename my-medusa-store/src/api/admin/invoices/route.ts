// GET  /admin/invoices          — fatura listesi
// POST /admin/invoices          — manuel fatura oluştur
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INVOICING_MODULE } from "../../../modules/invoicing"
import type InvoicingModuleService from "../../../modules/invoicing/service"
import { createInvoiceWorkflow } from "../../../workflows/create-invoice"
import { STORE_MANAGEMENT_MODULE } from "../../../modules/store-management"
import type StoreManagementService from "../../../modules/store-management/service"
import { Modules } from "@medusajs/framework/utils"

async function getStoreSalesChannelId(req: MedusaRequest): Promise<string | null> {
  const email = (req as any)._adminEmail
  if (!email) return null
  const svc = req.scope.resolve(STORE_MANAGEMENT_MODULE) as StoreManagementService
  if (await svc.isSuperAdmin(email)) return null // super admin → tüm faturalar
  const storeId = await svc.getStoreIdForAdmin(email)
  if (!storeId) return null
  const store = await svc.findStoreById(storeId)
  return (store as any)?.sales_channel_id ?? null
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const invoicingSvc = req.scope.resolve(INVOICING_MODULE) as InvoicingModuleService
    const scId = await getStoreSalesChannelId(req)

    const {
      order_id,
      status,
      limit = "20",
      offset = "0",
    } = req.query as Record<string, string>

    const filters: any = {}
    if (order_id) filters.order_id = order_id
    if (status)   filters.status   = status

    let [invoices, count] = await invoicingSvc.listAndCountInvoices(filters, {
      take: Number(limit),
      skip: Number(offset),
      order: { created_at: "DESC" },
    } as any)

    // Store admin ise yalnızca kendi SC'sine ait siparişlerin faturalarını göster
    if (scId) {
      try {
        const orderSvc = req.scope.resolve(Modules.ORDER) as any
        const storeOrders = await orderSvc.listOrders(
          { sales_channel_id: scId },
          { select: ["id"], take: 10000 }
        )
        const storeOrderIds = new Set(storeOrders.map((o: any) => o.id))
        invoices = invoices.filter((inv: any) => storeOrderIds.has(inv.order_id))
        count = invoices.length
      } catch (_) { /* Filtreleme başarısız → tümünü göster */ }
    }

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

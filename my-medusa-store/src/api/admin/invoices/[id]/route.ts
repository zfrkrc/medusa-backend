// GET    /admin/invoices/:id  — fatura detayı
// DELETE /admin/invoices/:id  — faturayı iptal et
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INVOICING_MODULE } from "../../../../modules/invoicing"
import type InvoicingModuleService from "../../../../modules/invoicing/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const invoicingSvc = req.scope.resolve(INVOICING_MODULE) as InvoicingModuleService
    const inv = await invoicingSvc.findById(req.params.id)
    if (!inv) return res.status(404).json({ error: "Fatura bulunamadı." })
    res.json({ invoice: inv })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const invoicingSvc = req.scope.resolve(INVOICING_MODULE) as InvoicingModuleService
    await invoicingSvc.cancelById(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
}

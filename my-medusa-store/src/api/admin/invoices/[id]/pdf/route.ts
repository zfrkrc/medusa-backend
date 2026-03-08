// GET /admin/invoices/:id/pdf — PDF indir
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INVOICING_MODULE } from "../../../../../modules/invoicing"
import type InvoicingModuleService from "../../../../../modules/invoicing/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const invoicingSvc = req.scope.resolve(INVOICING_MODULE) as InvoicingModuleService

    const inv = await invoicingSvc.findById(req.params.id)
    if (!inv) return res.status(404).json({ error: "Fatura bulunamadı." })

    // pdf_url varsa redirect et (bazı sağlayıcılar doğrudan URL verir)
    if (inv.pdf_url && !(req.query.force_download)) {
      return res.redirect(inv.pdf_url as string)
    }

    // Provider'dan PDF binary olarak çek
    const pdfBuffer = await invoicingSvc.fetchPdf(req.params.id)

    const filename = `fatura-${inv.invoice_number ?? req.params.id}.pdf`
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    res.setHeader("Content-Length", pdfBuffer.length)
    res.end(pdfBuffer)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
}

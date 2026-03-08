// GET /admin/shipping/providers — kayıtlı kargo sağlayıcıları listele
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const shippingSvc = req.scope.resolve("shipping") as any
    const providers: string[] = shippingSvc.listProviders?.() ?? []
    const defaultId: string | null = shippingSvc.defaultProviderId ?? null

    res.json({
      providers: providers.map((id: string) => ({
        id,
        is_default: id === defaultId,
      })),
      count: providers.length,
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { default_provider } = req.body as any
    if (!default_provider) {
      return res.status(400).json({ error: "default_provider zorunludur." })
    }
    const shippingSvc = req.scope.resolve("shipping") as any
    shippingSvc.setDefaultProvider(default_provider)
    res.json({ success: true, default_provider })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
}

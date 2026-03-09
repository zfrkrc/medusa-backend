// GET /admin/shipping/providers — kayıtlı kargo sağlayıcıları listele (Sadece Süper Admin)
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { STORE_MANAGEMENT_MODULE } from "../../../../modules/store-management"
import type StoreManagementService from "../../../../modules/store-management/service"

async function requireSuperAdmin(req: MedusaRequest, res: MedusaResponse): Promise<boolean> {
  const email = (req as any)._adminEmail
  if (!email) { res.status(401).json({ error: "Kimlik doğrulama gerekli." }); return false }
  const svc = req.scope.resolve(STORE_MANAGEMENT_MODULE) as StoreManagementService
  const isSuperAdmin = await svc.isSuperAdmin(email)
  if (!isSuperAdmin) { res.status(403).json({ error: "Bu işlem yalnızca süper admin tarafından yapılabilir." }); return false }
  return true
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!await requireSuperAdmin(req, res)) return
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
  if (!await requireSuperAdmin(req, res)) return
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

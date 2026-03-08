import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { STORE_MANAGEMENT_MODULE } from "../../../../modules/store-management"
import StoreManagementService from "../../../../modules/store-management/service"

/**
 * GET  /admin/store-management/stores  — list all store tenants
 * POST /admin/store-management/stores  — create a new store tenant
 */

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    // Only super admins can list all stores
    if (!(req as any).is_super_admin && !(req as any).store_id === undefined) {
        return res.status(403).json({ message: "Forbidden" })
    }

    const service: StoreManagementService = req.scope.resolve(STORE_MANAGEMENT_MODULE)
    const stores = await service.listStores()
    return res.json({ stores })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    // Only super admins can create stores
    if (!(req as any).is_super_admin) {
        return res.status(403).json({ message: "Only super admins can create stores." })
    }

    const service: StoreManagementService = req.scope.resolve(STORE_MANAGEMENT_MODULE)
    const { name, handle, domain, publishable_key_id } = req.body as any

    if (!name || !handle) {
        return res.status(400).json({ message: "name and handle are required." })
    }

    const store = await service.createStores({ name, handle, domain, publishable_key_id })
    return res.status(201).json({ store })
}

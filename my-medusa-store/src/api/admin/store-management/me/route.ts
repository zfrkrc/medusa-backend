import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { STORE_MANAGEMENT_MODULE } from "../../../../modules/store-management"
import StoreManagementService from "../../../../modules/store-management/service"

/**
 * GET /admin/store-management/me
 *
 * Returns the current admin's store context:
 * - role (super_admin | store_admin)
 * - store (the store tenant, if store_admin)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const storeId: string | null = (req as any).store_id
    const isSuperAdmin: boolean = (req as any).is_super_admin ?? false

    const service: StoreManagementService = req.scope.resolve(STORE_MANAGEMENT_MODULE)

    let store = null
    if (storeId) {
        store = await service.findStoreById(storeId)
    }

    return res.json({
        role: isSuperAdmin ? "super_admin" : "store_admin",
        store_id: storeId,
        store,
    })
}

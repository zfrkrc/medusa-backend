import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { STORE_MANAGEMENT_MODULE } from "../../../../../modules/store-management"
import StoreManagementService from "../../../../../modules/store-management/service"

/**
 * GET    /admin/store-management/stores/:id  — get one store
 * PUT    /admin/store-management/stores/:id  — update a store
 * DELETE /admin/store-management/stores/:id  — delete a store
 */

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const { id } = req.params
    const service: StoreManagementService = req.scope.resolve(STORE_MANAGEMENT_MODULE)

    const store = await service.findStoreById(id)
    if (!store) return res.status(404).json({ message: "Store not found" })

    return res.json({ store })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
    if (!(req as any).is_super_admin) {
        return res.status(403).json({ message: "Only super admins can update stores." })
    }

    const { id } = req.params
    const service: StoreManagementService = req.scope.resolve(STORE_MANAGEMENT_MODULE)
    const updated = await service.updateStores({ id }, req.body as any)
    return res.json({ store: updated })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    if (!(req as any).is_super_admin) {
        return res.status(403).json({ message: "Only super admins can delete stores." })
    }

    const { id } = req.params
    const service: StoreManagementService = req.scope.resolve(STORE_MANAGEMENT_MODULE)
    await service.deleteStores(id)
    return res.json({ id, deleted: true })
}

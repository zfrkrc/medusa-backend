import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { STORE_MANAGEMENT_MODULE } from "../../../../modules/store-management"
import StoreManagementService from "../../../../modules/store-management/service"

/**
 * GET  /admin/store-management/admins   — list admin-user mappings
 * POST /admin/store-management/admins   — create or update an admin mapping
 *
 * This is NOT for creating Medusa admin users — it manages the store
 * association and role of existing Medusa admin users.
 */

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    if (!(req as any).is_super_admin) {
        return res.status(403).json({ message: "Forbidden" })
    }

    const service: StoreManagementService = req.scope.resolve(STORE_MANAGEMENT_MODULE)
    const admins = await service.listAdminUsers()
    return res.json({ admins })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    if (!(req as any).is_super_admin) {
        return res.status(403).json({ message: "Only super admins can manage admin roles." })
    }

    const service: StoreManagementService = req.scope.resolve(STORE_MANAGEMENT_MODULE)
    const { email, role, store_id } = req.body as any

    if (!email || !role) {
        return res.status(400).json({ message: "email and role are required." })
    }

    if (role === "store_admin" && !store_id) {
        return res.status(400).json({ message: "store_id is required for store_admin role." })
    }

    // Upsert: update if exists, create if not
    const existing = await service.findAdminByEmail(email)

    let adminUser
    if (existing) {
        adminUser = await service.updateAdminUsers({ email } as any, { role, store_id: role === "super_admin" ? null : store_id })
    } else {
        adminUser = await service.createAdminUsers({ email, role, store_id: role === "super_admin" ? null : store_id })
    }

    return res.status(201).json({ admin: adminUser })
}

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * GET /admin/store-management/customers
 *
 * Returns customers filtered by store.
 * Customers are tagged with metadata.store_id when they register via
 * a specific storefront (handled in the store API layer).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const storeId: string | null = (req as any).store_id
    const isSuperAdmin: boolean = (req as any).is_super_admin ?? false

    const customerService = req.scope.resolve(Modules.CUSTOMER)

    const {
        limit = 20,
        offset = 0,
        q,
        email,
    } = req.query as any

    const filters: any = {}

    if (!isSuperAdmin && storeId) {
        filters["metadata.store_id"] = storeId
    }

    if (q) filters.q = q
    if (email) filters.email = email

    const [customers, count] = await customerService.listAndCountCustomers(filters, {
        take: Number(limit),
        skip: Number(offset),
    })

    return res.json({ customers, count, limit: Number(limit), offset: Number(offset) })
}

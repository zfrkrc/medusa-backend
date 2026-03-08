import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * GET /admin/store-management/orders
 *
 * Returns orders filtered by the authenticated admin's store.
 * Orders are tagged with metadata.store_id at creation time via the
 * store workflow (see src/workflows/).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const storeId: string | null = (req as any).store_id
    const isSuperAdmin: boolean = (req as any).is_super_admin ?? false

    const orderService = req.scope.resolve(Modules.ORDER)

    const {
        limit = 20,
        offset = 0,
        status,
        customer_id,
    } = req.query as any

    const filters: any = {}

    if (!isSuperAdmin && storeId) {
        filters["metadata.store_id"] = storeId
    }

    if (status) filters.status = status
    if (customer_id) filters.customer_id = customer_id

    const [orders, count] = await orderService.listAndCountOrders(filters, {
        take: Number(limit),
        skip: Number(offset),
        relations: ["items", "customer", "shipping_address"],
    })

    return res.json({ orders, count, limit: Number(limit), offset: Number(offset) })
}

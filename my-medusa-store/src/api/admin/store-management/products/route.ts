import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * GET /admin/store-management/products
 *
 * Returns products filtered by the authenticated admin's store.
 * super_admin gets all products; store_admin gets only their store's products
 * (filtered via sales_channel linked to their store's publishable key).
 *
 * The store-sales-channel association relies on the standard Medusa
 * SalesChannel ↔ Product link. Each store should have its own sales channel.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const storeId: string | null = (req as any).store_id
    const isSuperAdmin: boolean = (req as any).is_super_admin ?? false

    const productService = req.scope.resolve(Modules.PRODUCT)

    // Build filter
    const query: any = {}

    // If not super_admin, we need to scope by sales_channel linked to the store.
    // For now we use metadata.store_id as a convention (populated via seed/setup script).
    if (!isSuperAdmin && storeId) {
        query.filters = {
            metadata: { store_id: storeId },
        }
    }

    const {
        limit = 20,
        offset = 0,
        q,
        status,
        collection_id,
        tags,
    } = req.query as any

    const [products, count] = await productService.listAndCountProducts(
        {
            ...(q ? { q } : {}),
            ...(status ? { status } : {}),
            ...(collection_id ? { collection_id } : {}),
            ...(!isSuperAdmin && storeId
                ? { "metadata.store_id": storeId }
                : {}),
        },
        {
            take: Number(limit),
            skip: Number(offset),
            relations: ["variants", "images", "tags", "collection"],
        }
    )

    return res.json({ products, count, limit: Number(limit), offset: Number(offset) })
}

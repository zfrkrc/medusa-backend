import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { STORE_MANAGEMENT_MODULE } from "../modules/store-management"
import StoreManagementService from "../modules/store-management/service"

/**
 * Tag existing products with their store_id AND link them to Sales Channels.
 */

const PRODUCT_STORE_MAP: Record<string, string> = {
    "urun007": "clay-store",
}
const DEFAULT_STORE_HANDLE = "hobby-store"

export default async function setupProductStoreTags({ container }: ExecArgs) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const productService = container.resolve(Modules.PRODUCT)
    const storeService: StoreManagementService = container.resolve(STORE_MANAGEMENT_MODULE)
    const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)

    // Build store handle → (storeId, scId) lookup
    const stores = await storeService.listStores()
    const storeInfoByHandle: Record<string, { id: string, scId: string }> = {}
    for (const s of stores) {
        storeInfoByHandle[(s as any).handle] = {
            id: (s as any).id,
            scId: (s as any).sales_channel_id
        }
    }

    const defaultStore = storeInfoByHandle[DEFAULT_STORE_HANDLE]
    if (!defaultStore || !defaultStore.scId) {
        logger.error(`Default store '${DEFAULT_STORE_HANDLE}' or its Sales Channel missing. Run setup-multistore.ts first.`)
        return
    }

    const [products] = await productService.listAndCountProducts({}, { take: 1000 })
    logger.info(`  📦 ${products.length} ürün işleniyor...`)

    let updated = 0

    for (const product of products) {
        const storeHandle = PRODUCT_STORE_MAP[product.handle!] ?? DEFAULT_STORE_HANDLE
        const info = storeInfoByHandle[storeHandle] ?? defaultStore

        // 1. Update metadata
        await productService.updateProducts(product.id, {
            metadata: {
                ...(product.metadata as any),
                store_id: info.id,
                store_handle: storeHandle,
            },
        })

        // 2. Link to Sales Channel (standard Medusa v2 Link)
        try {
            await remoteLink.create({
                [Modules.PRODUCT]: {
                    product_id: product.id,
                },
                [Modules.SALES_CHANNEL]: {
                    sales_channel_id: info.scId,
                },
            })
        } catch (e) {
            // Already linked? 
        }

        logger.info(`  ✅ ${product.handle} → ${storeHandle} (SC: ${info.scId})`)
        updated++
    }

    logger.info(`\n  ✅ Tamamlanan: ${updated}`)
}

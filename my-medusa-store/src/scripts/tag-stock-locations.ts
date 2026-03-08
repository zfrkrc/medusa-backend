import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { STORE_MANAGEMENT_MODULE } from "../modules/store-management"
import StoreManagementService from "../modules/store-management/service"

/**
 * Tag existing Stock Locations with store_id to make them visible to Store Admins.
 */
export default async function tagStockLocations({ container }: ExecArgs) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const slService = container.resolve(Modules.STOCK_LOCATION)
    const storeService: StoreManagementService = container.resolve(STORE_MANAGEMENT_MODULE)

    // Build lookup
    const stores = await storeService.listStores()
    const hobbyStore = stores.find((s: any) => s.handle === "hobby-store")
    const clayStore = stores.find((s: any) => s.handle === "clay-store")
    const sedefliStore = stores.find((s: any) => s.handle === "sedefli-store")

    if (!hobbyStore) {
        logger.error("  ❌ Hobby store missing. Run setup-multistore.ts first.")
        return
    }

    const locations = await slService.listStockLocations({}, { take: 1000 })
    logger.info(`  📦 ${locations.length} lokasyon işleniyor...`)

    for (const location of locations) {
        let storeId = (hobbyStore as any).id

        // Match by name if possible
        const name = location.name.toLowerCase()
        if (name.includes("clay")) storeId = (clayStore as any).id
        if (name.includes("sedefli")) storeId = (sedefliStore as any).id

        await slService.updateStockLocations(location.id, {
            metadata: {
                ...location.metadata,
                store_id: storeId
            }
        })
        logger.info(`  ✅ ${location.name} → Store: ${storeId}`)
    }

    logger.info("🎉 Lokasyon etiketleme tamamlandı!")
}

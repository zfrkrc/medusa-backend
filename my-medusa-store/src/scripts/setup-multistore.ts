import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { STORE_MANAGEMENT_MODULE } from "../modules/store-management"
import StoreManagementService from "../modules/store-management/service"

/**
 * Setup Multi-Store Tenants with Sales Channels
 */

const STORES = [
    {
        name: "Clay by Sevgi",
        handle: "clay-store",
        domain: "panel.claybysevgi.com",
    },
    {
        name: "Hobby Store",
        handle: "hobby-store",
        domain: "panel.zaferkaraca.net",
    },
    {
        name: "Sedefli Atölye",
        handle: "sedefli-store",
        domain: "panel.sedefliatolye.com.tr",
    },
]

const ADMINS = [
    {
        email: "zafer@zaferkaraca.net",
        role: "super_admin" as const,
        store_id: null,
    },
    {
        email: "clay@claybysevgi.com",
        role: "store_admin" as const,
        storeHandle: "clay-store",
    },
    {
        email: "hobby@zaferkaraca.net",
        role: "store_admin" as const,
        storeHandle: "hobby-store",
    },
    {
        email: "sedefli@sedefliatolye.com.tr",
        role: "store_admin" as const,
        storeHandle: "sedefli-store",
    },
]

export default async function setupMultiStore({ container }: ExecArgs) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const storeMgmtService: StoreManagementService = container.resolve(STORE_MANAGEMENT_MODULE)
    const scService = container.resolve(Modules.SALES_CHANNEL)

    logger.info("🏪 Multi-store setup (Sales Channels) başlıyor...")

    const storeMap: Record<string, string> = {}
    const scMap: Record<string, string> = {}

    // 1. Create / update store tenants & sales channels
    for (const storeData of STORES) {
        let existing = await storeMgmtService.findStoreByHandle(storeData.handle)

        // Ensure Sales Channel exists
        let scId = (existing as any)?.sales_channel_id
        if (!scId) {
            const [existingSc] = await scService.listSalesChannels({ name: storeData.name })
            if (existingSc) {
                scId = existingSc.id
                logger.info(`  ⏭️  Sales Channel zaten var: ${storeData.name} (id: ${scId})`)
            } else {
                const sc = await scService.createSalesChannels({
                    name: storeData.name,
                    description: `${storeData.name} isolation channel`,
                })
                scId = sc.id
                logger.info(`  ✅ Sales Channel oluşturuldu: ${storeData.name} (id: ${scId})`)
            }
        }
        scMap[storeData.handle] = scId

        if (existing) {
            logger.info(`  ⏭️  Store zaten var: ${storeData.handle} (id: ${existing.id})`)
            if (!(existing as any).sales_channel_id) {
                await storeMgmtService.updateStores({
                    id: existing.id,
                    sales_channel_id: scId
                } as any)
                logger.info(`  🔄 Store sales_channel_id ile güncellendi.`)
            }
            storeMap[storeData.handle] = existing.id
        } else {
            const store = await storeMgmtService.createStores({
                ...storeData,
                sales_channel_id: scId
            } as any)
            logger.info(`  ✅ Store oluşturuldu: ${storeData.handle} (id: ${(store as any).id})`)
            storeMap[storeData.handle] = (store as any).id
        }
    }

    // 2. Create / update admin mappings
    for (const adminData of ADMINS) {
        const storeId = adminData.role === "super_admin"
            ? null
            : storeMap[(adminData as any).storeHandle]

        const existing = await storeMgmtService.findAdminByEmail(adminData.email)

        if (existing) {
            await storeMgmtService.updateAdminUsers({
                id: existing.id,
                role: adminData.role,
                store_id: storeId,
            } as any)
            logger.info(`  🔄 Admin güncellendi: ${adminData.email} → ${adminData.role}${storeId ? ` (${storeId})` : ""}`)
        } else {
            await storeMgmtService.createAdminUsers({
                email: adminData.email,
                role: adminData.role,
                store_id: storeId,
            } as any)
            logger.info(`  ✅ Admin oluşturuldu: ${adminData.email} → ${adminData.role}${storeId ? ` (${storeId})` : ""}`)
        }
    }

    logger.info("🎉 Multi-store setup tamamlandı!")
    logger.info("Store ID'leri:")
    for (const [handle, id] of Object.entries(storeMap)) {
        logger.info(`  ${handle}: ${id}`)
    }
    logger.info("\n📌 Ürünlere store_id eklemek için setup-product-store-tags.ts scriptini çalıştırın.")
}

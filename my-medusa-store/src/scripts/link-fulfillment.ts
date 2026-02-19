import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function linkStoreToProfile({ container }: ExecArgs) {
    const logger = container.resolve("logger")
    const remoteLink = container.resolve("remoteLink")
    const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
    const storeModule = container.resolve(Modules.STORE)

    logger.info("Attempting to link Store -> Shipping Profile...")

    try {
        // 1. Get Default Store
        const stores = await storeModule.listStores()
        const store = stores[0]
        if (!store) {
            logger.error("No store found!")
            return
        }

        // 2. Get Shipping Profile
        const profiles = await fulfillmentModule.listShippingProfiles({ type: "default" })
        const profile = profiles[0]

        if (!profile) {
            logger.error("No profile found to link!")
            return
        }

        // 3. Link Them
        // Note: In Medusa v2, Shipping Profile is linked to store via... actually it is NOT directly linked in the link table usually.
        // It's linked via sales channels or implicitly.
        // However, let's try to verify if we can link it explicitly to create visibility.

        /* 
           Actually, Shipping Options are linked to Service Zones, which are linked to Fulfillment Sets, 
           which are linked to Stock Locations.
           Let's check THAT chain.
        */

        logger.info(`Store: ${store.id}, Profile: ${profile.id}`)

        // Create a Fulfillment Set if missing (This is the bridge!)
        const serviceName = "Manual Service"
        const [fulfillmentSet] = await fulfillmentModule.listFulfillmentSets({ name: serviceName })

        if (!fulfillmentSet) {
            logger.info("Creating Fulfillment Set to enable shipping...")
            await fulfillmentModule.createFulfillmentSets([{
                name: serviceName,
                type: "manual",
                service_zones: [
                    {
                        name: "Global Zone",
                        geo_zones: [{ type: "country", country_code: "tr" }]
                    }
                ]
            }])
        }

        // Now LINK Stock Location -> Fulfillment Set
        const stockLocationService = container.resolve(Modules.STOCK_LOCATION)
        const [sl] = await stockLocationService.listStockLocations({ name: "Default Warehouse" })
        const [fs] = await fulfillmentModule.listFulfillmentSets({ name: serviceName })

        if (sl && fs) {
            await remoteLink.create([
                {
                    [Modules.STOCK_LOCATION]: { stock_location_id: sl.id },
                    [Modules.FULFILLMENT]: { fulfillment_set_id: fs.id }
                }
            ])
            logger.info(`✅ Linked Stock Location (${sl.id}) -> Fulfillment Set (${fs.id})`)
        } else {
            logger.warn("Could not find SL or FS to link.")
        }

    } catch (e) {
        logger.error(`Error: ${e.message}`)
    }
}

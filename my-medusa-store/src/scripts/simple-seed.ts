import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function seedDemoData({ container }: ExecArgs) {
    const logger = container.resolve("logger")
    const regionService = container.resolve(Modules.REGION)
    const taxModule = container.resolve(Modules.TAX)
    const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
    const stockLocationService = container.resolve(Modules.STOCK_LOCATION)
    const fulfillmentModule = container.resolve(Modules.FULFILLMENT)

    logger.info("Seeding robust store data...")

    // 1. Sales Channel
    const [salesChannel] = await salesChannelService.listSalesChannels({ name: "Default Sales Channel" })
    let scId = salesChannel?.id

    if (!scId) {
        const sc = await salesChannelService.createSalesChannels([{ name: "Default Sales Channel" }])
        scId = sc[0].id
        logger.info(`Created Sales Channel: ${scId}`)
    } else {
        logger.info(`Using existing Sales Channel: ${scId}`)
    }

    // 2. Stock Location
    const [stockLoc] = await stockLocationService.listStockLocations({ name: "Default Warehouse" })
    let slId = stockLoc?.id

    if (!slId) {
        const sl = await stockLocationService.createStockLocations([{ name: "Default Warehouse" }])
        slId = sl[0].id
        logger.info(`Created Stock Location: ${slId}`)
    } else {
        logger.info(`Using existing Stock Location: ${slId}`)
    }

    // 3. Tax Region
    try {
        const existingTax = await taxModule.listTaxRegions({ country_code: "tr" })
        if (existingTax.length === 0) {
            await taxModule.createTaxRegions([{ country_code: "tr", province_code: null }])
            logger.info("Created Tax Region for TR")
        }
    } catch (e) {
        logger.warn("Tax region creation skipped: " + (e as Error).message)
    }

    // 4. Region
    const [existingRegion] = await regionService.listRegions({ currency_code: "try" })
    if (!existingRegion) {
        await regionService.createRegions([{
            name: "Turkey",
            currency_code: "try",
            countries: ["tr"],
            automatic_taxes: true
        }])
        logger.info("Created Region: Turkey (TRY)")
    }

    // 5. Shipping Profile (CRITICAL FIX)
    const existingProfiles = await fulfillmentModule.listShippingProfiles({ name: "Default Shipping Profile" })
    if (existingProfiles.length === 0) {
        await fulfillmentModule.createShippingProfiles([{
            name: "Default Shipping Profile",
            type: "default"
        }])
        logger.info("Created Default Shipping Profile")
    } else {
        logger.info("Default Shipping Profile already exists.")
    }

    logger.info("Seed completed successfully!")
}

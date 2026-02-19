// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function setupStore({ container }: ExecArgs) {
    const logger = container.resolve("logger")
    const regionService = container.resolve(Modules.REGION)
    const taxModule = container.resolve(Modules.TAX)
    const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
    const stockLocationService = container.resolve(Modules.STOCK_LOCATION)
    const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
    const remoteLink = container.resolve("remoteLink")

    logger.info("Starting Full Store Setup (Safe Mode)...")

    // 1. REGION & TAX
    try {
        const existingTax = await taxModule.listTaxRegions({ country_code: "tr" })
        if (existingTax.length === 0) {
            await taxModule.createTaxRegions([{ country_code: "tr", province_code: null }])
            const [trTax] = await taxModule.listTaxRegions({ country_code: "tr" })
            await taxModule.createTaxRates([{ tax_region_id: trTax.id, name: "KDV", rate: 20, code: "KDV20" }])
            logger.info("Created Tax Region: TR (20%)")
        }

        const [existingRegion] = await regionService.listRegions({ currency_code: "try" })
        if (!existingRegion) {
            await regionService.createRegions([{ name: "Turkey", currency_code: "try", countries: ["tr"], automatic_taxes: true }])
            logger.info("Created Region: Turkey")
        }
    } catch (e) { logger.warn(`Region step issue: ${e.message}`) }

    // 2. SC & SL
    let scId = "", slId = ""
    const [sc] = await salesChannelService.listSalesChannels({ name: "Default Sales Channel" })
    if (!sc) {
        const newSc = await salesChannelService.createSalesChannels([{ name: "Default Sales Channel" }])
        scId = newSc[0].id
    } else { scId = sc.id }

    const [sl] = await stockLocationService.listStockLocations({ name: "Default Warehouse" })
    if (!sl) {
        const newSl = await stockLocationService.createStockLocations([{ name: "Default Warehouse" }])
        slId = newSl[0].id
    } else { slId = sl.id }

    try {
        await remoteLink.create([{ [Modules.SALES_CHANNEL]: { sales_channel_id: scId }, [Modules.STOCK_LOCATION]: { stock_location_id: slId } }])
        logger.info("Linked SC <-> SL")
    } catch (e) { }

    // 3. FULFILLMENT
    let spId = "", fsId = ""
    const [sp] = await fulfillmentModule.listShippingProfiles({ type: "default" })
    if (!sp) {
        const newSp = await fulfillmentModule.createShippingProfiles([{ name: "Default Profile", type: "default" }])
        spId = newSp[0].id
    } else { spId = sp.id }

    const [fs] = await fulfillmentModule.listFulfillmentSets({ name: "Manual Fulfillment" })
    if (!fs) {
        const newFs = await fulfillmentModule.createFulfillmentSets([{ name: "Manual Fulfillment", type: "manual", service_zones: [{ name: "Turkey Zone", geo_zones: [{ type: "country", country_code: "tr" }] }] }])
        fsId = newFs[0].id
    } else { fsId = fs.id }

    try {
        await remoteLink.create([{ [Modules.STOCK_LOCATION]: { stock_location_id: slId }, [Modules.FULFILLMENT]: { fulfillment_set_id: fsId } }])
        logger.info("Linked SL <-> FS")
    } catch (e) { }

    // 4. SHIPPING OPTION
    try {
        if (fsId && spId) {
            const fullFs = await fulfillmentModule.retrieveFulfillmentSet(fsId, { relations: ["service_zones"] })
            const serviceZoneId = fullFs.service_zones[0].id
            const [existingOption] = await fulfillmentModule.listShippingOptions({ name: "Standard Shipping" })
            if (!existingOption) {
                await fulfillmentModule.createShippingOptions([{
                    name: "Standard Shipping",
                    price_type: "flat",
                    service_zone_id: serviceZoneId,
                    shipping_profile_id: spId,
                    provider_id: "manual_manual",
                    type: { label: "Standard", description: "Standard delivery", code: "standard" },
                    prices: [{ currency_code: "try", amount: 0 }],
                    rules: []
                }])
                logger.info("Created Shipping Option")
            }
        }
    } catch (e) {
        logger.warn(`Shipping Option step: ${e.message}`)
    }

    logger.info("Setup Complete.")
}

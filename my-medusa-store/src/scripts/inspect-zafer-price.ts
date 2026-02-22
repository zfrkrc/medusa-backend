import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function inspectPrices({ container }: ExecArgs) {
    const pricingModuleService = container.resolve(Modules.PRICING)
    const productModuleService = container.resolve(Modules.PRODUCT)

    const [zafer] = await productModuleService.listProducts({
        title: "zafer"
    }, { relations: ["variants"] })

    if (zafer && zafer.variants[0]) {
        console.log("--- ZAFER PRICE DATA ---")
        const variantId = zafer.variants[0].id

        // Link'ten price_set_id bulalım
        const remoteQuery = container.resolve("remoteQuery")
        const query = {
            product_variant_price_set: {
                __args: {
                    variant_id: [variantId],
                },
                fields: ["price_set_id"],
            },
        }
        const links = await remoteQuery(query)
        console.log("Links:", JSON.stringify(links, null, 2))

        if (links.length > 0) {
            const priceSetId = links[0].price_set_id
            const priceSet = await pricingModuleService.retrievePriceSet(priceSetId, { relations: ["prices"] })
            console.log("Price Set:", JSON.stringify(priceSet, null, 2))
        }
    } else {
        console.log("Zafer product or variant not found")
    }
}

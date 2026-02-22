import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function updateSingleProduct({ container }: ExecArgs) {
    const logger = container.resolve("logger")
    const productModuleService = container.resolve(Modules.PRODUCT)
    const pricingModuleService = container.resolve(Modules.PRICING)
    const remoteQuery = container.resolve("remoteQuery")

    logger.info("Ürün 001 fiyatı düzeltiliyor...")

    const [product] = await productModuleService.listProducts({ handle: "urun001" }, { relations: ["variants"] })
    if (!product || !product.variants[0]) return

    const variant = product.variants[0]
    const amount = 1250 // 1,250.00 TL

    const links = await remoteQuery({
        entryPoint: "product_variant_price_set",
        fields: ["price_set_id"],
        variables: {
            variant_id: [variant.id],
        },
    }) as any[]

    if (links && links.length > 0) {
        const priceSetId = links[0].price_set_id
        const priceSet = await pricingModuleService.retrievePriceSet(priceSetId, { relations: ["prices"] })
        const tryPrice = priceSet.prices?.find(p => p.currency_code === "try")

        if (tryPrice) {
            await (pricingModuleService as any).upsertPriceSets([{
                id: priceSetId,
                prices: [{ id: tryPrice.id, amount: amount }]
            }])
            logger.info(`BAŞARILI: ${amount} TL ayarlandı.`)
        }
    }
}

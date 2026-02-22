import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function updateProductPrices({ container }: ExecArgs) {
    const logger = container.resolve("logger")
    const productModuleService = container.resolve(Modules.PRODUCT)
    const pricingModuleService = container.resolve(Modules.PRICING)
    const remoteLink = container.resolve("remoteLink")
    const remoteQuery = container.resolve("remoteQuery")

    logger.info("Fiyatlar güncelleniyor (DOĞRUDAN LİRA DEĞERİ)...")

    // 1. Önce tüm Price Listeleri temizleyelim (varsa karışıklık yapmasın)
    const priceLists = await pricingModuleService.listPriceLists({})
    if (priceLists.length > 0) {
        await pricingModuleService.deletePriceLists(priceLists.map(pl => pl.id))
        logger.info(`Temizlenen fiyat listesi sayısı: ${priceLists.length}`)
    }

    const products = await productModuleService.listProducts(
        { handle: { $like: "urun%" } },
        { relations: ["variants"] }
    )

    logger.info(`${products.length} adet ürün bulundu.`)

    for (const product of products) {
        for (const variant of product.variants) {
            // 1000 ile 3000 arası rastgele fiyat
            const amount = Math.floor(Math.random() * (3000 - 1000 + 1) + 1000)

            try {
                // Mevcut price_set var mı bakalım
                const links = await remoteQuery({
                    entryPoint: "product_variant_price_set",
                    fields: ["price_set_id"],
                    variables: {
                        variant_id: [variant.id],
                    },
                }) as any[]

                let priceSetId: string

                if (links && links.length > 0) {
                    // Güncelle
                    priceSetId = links[0].price_set_id
                    const priceSet = await pricingModuleService.retrievePriceSet(priceSetId, { relations: ["prices"] })
                    const tryPrice = priceSet.prices?.find(p => p.currency_code === "try")

                    if (tryPrice) {
                        await (pricingModuleService as any).upsertPriceSets([
                            {
                                id: priceSetId,
                                prices: [{ id: tryPrice.id, amount: amount }]
                            }
                        ])
                    } else {
                        // Price set var ama TRY yok
                        await (pricingModuleService as any).upsertPriceSets([
                            {
                                id: priceSetId,
                                prices: [{ currency_code: "try", amount: amount }]
                            }
                        ])
                    }
                    logger.info(`Güncellendi: ${product.title} -> ${amount} TL`)
                } else {
                    // Yeni oluştur
                    const priceSet = await pricingModuleService.createPriceSets([
                        {
                            prices: [{ currency_code: "try", amount: amount }]
                        }
                    ])
                    priceSetId = priceSet[0].id
                    await remoteLink.create([
                        {
                            [Modules.PRODUCT]: { variant_id: variant.id },
                            [Modules.PRICING]: { price_set_id: priceSetId }
                        }
                    ])
                    logger.info(`Oluşturuldu: ${product.title} -> ${amount} TL`)
                }
            } catch (error: any) {
                logger.error(`Hata (${product.title}): ${error.message}`)
            }
        }
    }

    logger.info("🎉 İşlem başarıyla tamamlandı.")
}

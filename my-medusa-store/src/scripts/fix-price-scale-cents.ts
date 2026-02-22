import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function fixPriceScale({ container }: ExecArgs) {
    const logger = container.resolve("logger")
    const pricingModuleService = container.resolve(Modules.PRICING)

    logger.info("Fiyatlar TL bazında 100 ile çarpılarak cent (kuruş) formatına getiriliyor...")

    const priceSets = await pricingModuleService.listPriceSets({}, { relations: ["prices"] })

    for (const ps of priceSets) {
        const tryPrice = ps.prices?.find((p: any) => p.currency_code === "try")
        if (tryPrice) {
            const currentAmount = Number(tryPrice.amount)
            // Eğer rakam 10000'den küçükse muhtemelen TL formatındadır (örn: 1500 -> 15.00 TL gösteriyor)
            // Biz bunu 1500.00 TL yapmak için 100 ile çarpıp 150000 yapmalıyız.
            if (currentAmount < 10000) {
                const newAmount = currentAmount * 100
                await (pricingModuleService as any).upsertPriceSets([
                    {
                        id: ps.id,
                        prices: [{ id: tryPrice.id, amount: newAmount, currency_code: "try" }]
                    }
                ])
                logger.info(`Düzenlendi: ${currentAmount} -> ${newAmount} (${newAmount / 100} TL)`)
            }
        }
    }

    logger.info("🎉 Tüm ana fiyatlar kuruş formatına çekildi.")
}

import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function listSales({ container }: ExecArgs) {
    const pricingModuleService = container.resolve(Modules.PRICING)
    const priceLists = await pricingModuleService.listPriceLists({}, { relations: ["prices"] })

    console.log(`Fiyat Listesi Sayısı: ${priceLists.length}`)
    for (const pl of priceLists) {
        console.log(`- ${pl.title} (${pl.type}): ${pl.prices?.length} fiyat`)
    }
}

import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function inspectPriceList({ container }: ExecArgs) {
    const pricingModuleService = container.resolve(Modules.PRICING)
    const allPriceLists = await pricingModuleService.listPriceLists(
        {},
        { relations: ["prices"] }
    )
    const priceLists = allPriceLists.filter(pl => pl.title === "Büyük İndirim")

    console.log("--- PRICE LIST DETAILS ---")
    console.log(JSON.stringify(priceLists, null, 2))
}

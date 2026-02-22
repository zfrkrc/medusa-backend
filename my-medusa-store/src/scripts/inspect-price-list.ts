import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function inspectPriceList({ container }: ExecArgs) {
    const pricingModuleService = container.resolve(Modules.PRICING)
    const priceLists = await pricingModuleService.listPriceLists(
        { title: "Büyük İndirim" },
        { relations: ["prices", "rules"] }
    )

    console.log("--- PRICE LIST DETAILS ---")
    console.log(JSON.stringify(priceLists, null, 2))
}

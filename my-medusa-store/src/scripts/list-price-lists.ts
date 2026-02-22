import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function listPriceLists({ container }: ExecArgs) {
    const pricingModuleService = container.resolve(Modules.PRICING)
    const priceLists = await pricingModuleService.listPriceLists({}, { relations: ["prices"] })
    console.log("Price Lists:", JSON.stringify(priceLists, null, 2))
}

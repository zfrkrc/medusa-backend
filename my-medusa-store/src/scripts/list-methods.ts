import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function listMethods({ container }: ExecArgs) {
    const pricingModuleService = container.resolve(Modules.PRICING)
    console.log("METHODS:", Object.keys(pricingModuleService).sort().join(", "))
    // Check proto too
    console.log("PROTO METHODS:", Object.getOwnPropertyNames(Object.getPrototypeOf(pricingModuleService)).sort().join(", "))
}

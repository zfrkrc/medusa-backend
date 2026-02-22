import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function listCurrencies({ container }: ExecArgs) {
    // There isn't a direct "CURRENCY" module usually, it's often handled in the Store or Region settings
    // or we can use the database directly if we are unsure.
    // However, let's try to get regions.
    const regionModuleService = container.resolve(Modules.REGION)
    const regions = await regionModuleService.listRegions({}, { relations: ["countries"] })
    console.log("Regions:", JSON.stringify(regions, null, 2))
}

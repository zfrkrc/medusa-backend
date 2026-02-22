import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function debugFix({ container }: ExecArgs) {
    const pricingModuleService = container.resolve(Modules.PRICING)

    try {
        const priceSets = await pricingModuleService.listPriceSets({}, { relations: ["prices"] })

        for (const ps of priceSets) {
            const tryPrice = ps.prices?.find(p => p.currency_code === "try")
            if (tryPrice && tryPrice.amount > 3000) {
                const newAmount = Math.floor(tryPrice.amount / 100)
                console.log(`Upserting ${ps.id}: ${newAmount}`)
                await pricingModuleService.upsertPriceSets([
                    {
                        id: ps.id,
                        prices: [{ id: tryPrice.id, amount: newAmount, currency_code: "try" }]
                    }
                ])
            }
        }
    } catch (e) {
        console.error("ERROR:", e.message)
    }
    console.log("FINISH")
}

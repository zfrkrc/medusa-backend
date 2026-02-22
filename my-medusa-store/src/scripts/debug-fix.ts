import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function debugFix({ container }: ExecArgs) {
    const pricingModuleService = container.resolve(Modules.PRICING)

    try {
        const priceSets = await pricingModuleService.listPriceSets({}, { relations: ["prices"] })

        for (const ps of priceSets) {
            const tryPrice = ps.prices?.find((p: any) => p.currency_code === "try")
            const amount = Number(tryPrice?.amount || 0)
            if (tryPrice && amount > 3000) {
                const newAmount = Math.floor(amount / 100)
                console.log(`Upserting ${ps.id}: ${newAmount}`)
                await pricingModuleService.upsertPriceSets([
                    {
                        id: ps.id,
                        prices: [{ id: tryPrice.id, amount: newAmount, currency_code: "try" }]
                    }
                ])
            }
        }
    } catch (e: any) {
        console.error("ERROR:", e.message)
    }
    console.log("FINISH")
}

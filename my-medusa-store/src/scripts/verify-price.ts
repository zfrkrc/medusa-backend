import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function verifyCalculatedPrice({ container }: ExecArgs) {
    const remoteQuery = container.resolve("remoteQuery")
    const regionModuleService = container.resolve(Modules.REGION)
    const [region] = await regionModuleService.listRegions({})

    // Medusa Remote Query can handle variables for calculated_price
    const result = await remoteQuery({
        entryPoint: "product",
        variables: {
            handle: "urun001",
            region_id: region.id,
            currency_code: "try"
        },
        fields: [
            "id",
            "title",
            "variants.id",
            "variants.title",
            "variants.calculated_price.calculated_amount",
            "variants.calculated_price.original_amount",
            "variants.calculated_price.price_list_type"
        ]
    })

    console.log("--- SIMULATED STOREFRONT PRICE DATA ---")
    console.log(JSON.stringify(result, null, 2))
}

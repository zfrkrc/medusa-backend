import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function checkCalculatedPrice({ container }: ExecArgs) {
    const remoteQuery = container.resolve("remoteQuery")

    // Check product 001
    const query = {
        product: {
            __args: { handle: "urun001" },
            fields: ["id", "title"],
            variants: {
                fields: ["id", "title"],
                calculated_price: {
                    fields: ["calculated_amount", "original_amount", "currency_code", "price_list_type"]
                }
            }
        }
    }

    const result = await remoteQuery(query)
    console.log("Calculated Price for Product 001:")
    console.log(JSON.stringify(result, null, 2))
}

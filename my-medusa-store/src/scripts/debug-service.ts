import { ExecArgs } from "@medusajs/framework/types"

export default async function debugService({ container }: ExecArgs) {
    const addressTrService = container.resolve("address_tr") as any
    console.log("Service methods:", Object.keys(addressTrService))
    console.log("Service proto methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(addressTrService)))
}

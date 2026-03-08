import { ExecArgs } from "@medusajs/framework/types"

export default async function debugContainer({ container }: ExecArgs) {
    const keys = container.registrations
    console.log("Container Keys:", Object.keys(keys).filter(k => k.includes("address") || k.includes("store")))
}

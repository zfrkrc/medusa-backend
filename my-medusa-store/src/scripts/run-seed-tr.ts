import { ExecArgs } from "@medusajs/framework/types"
import { seedTrAddressesWorkflow } from "../workflows/seed-tr-addresses"

export default async function runSeedWorkflow({ container }: ExecArgs) {
    const { result } = await seedTrAddressesWorkflow(container).run()
    console.log(`Seeded ${result.length} provinces.`)
}

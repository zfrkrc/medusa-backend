import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { seedTrAddressesWorkflow } from "../../../../workflows/seed-tr-addresses"

export async function POST(
    req: MedusaRequest,
    res: MedusaResponse
) {
    const { result } = await seedTrAddressesWorkflow(req.scope).run()

    res.json({
        message: "Turkey address seed completed",
        provinces_seeded: result.length
    })
}

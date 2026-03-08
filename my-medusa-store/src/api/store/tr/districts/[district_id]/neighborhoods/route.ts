import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(
    req: MedusaRequest,
    res: MedusaResponse
) {
    const { district_id } = req.params
    const pgConnection = req.scope.resolve("__pg_connection__") as any

    const result = await pgConnection.raw(
        "SELECT id, name, postal_code FROM tr_neighborhood WHERE district_id = ? ORDER BY name ASC",
        [district_id]
    )

    res.json({
        neighborhoods: result.rows,
        count: result.rows.length
    })
}

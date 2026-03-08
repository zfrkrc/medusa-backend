import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(
    req: MedusaRequest,
    res: MedusaResponse
) {
    const { province_id } = req.params
    const pgConnection = req.scope.resolve("__pg_connection__") as any

    const result = await pgConnection.raw(
        "SELECT id, name FROM tr_district WHERE province_id = ? ORDER BY name ASC",
        [province_id]
    )

    res.json({
        districts: result.rows,
        count: result.rows.length
    })
}

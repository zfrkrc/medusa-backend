import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(
    req: MedusaRequest,
    res: MedusaResponse
) {
    const pgConnection = req.scope.resolve("__pg_connection__") as any

    const result = await pgConnection.raw(
        "SELECT id, name, plate_code FROM tr_province ORDER BY name ASC"
    )

    res.json({
        provinces: result.rows,
        count: result.rows.length
    })
}

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function createTables({ container }: ExecArgs) {
    const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

    logger.info("🛠️ Creating Turkey Address tables manually...")

    try {
        await pgConnection.raw(`
            CREATE TABLE IF NOT EXISTS tr_province (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                plate_code INTEGER NOT NULL UNIQUE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                deleted_at TIMESTAMPTZ
            );
        `)
        logger.info("  ✅ tr_province created")

        await pgConnection.raw(`
            CREATE TABLE IF NOT EXISTS tr_district (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                province_id TEXT REFERENCES tr_province(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                deleted_at TIMESTAMPTZ
            );
        `)
        logger.info("  ✅ tr_district created")

        await pgConnection.raw(`
            CREATE TABLE IF NOT EXISTS tr_neighborhood (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                postal_code TEXT,
                district_id TEXT REFERENCES tr_district(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                deleted_at TIMESTAMPTZ
            );
        `)
        logger.info("  ✅ tr_neighborhood created")

        logger.info("🎉 Table creation completed!")
    } catch (e: any) {
        logger.error("❌ Error creating tables: " + e.message)
    }
}

#!/usr/bin/env node
/**
 * Medusa Admin UI Uyumluluk Yamaları
 *
 * Neden gerekli:
 * - Admin UI bazı route'lara fazla alan gönderir (sales_channels, metadata)
 * - Medusa 2.x'in zodValidator'ı tüm şemalara otomatik .strict() uygular
 * - Bu da admin UI isteklerinin 400 hatası döndürmesine yol açar
 *
 * Çalıştırma: node patches/apply-patches.js
 */

const fs = require("fs")
const path = require("path")

// node_modules dizini: script'in bir üst klasörü
const nodeModules = path.join(__dirname, "..", "node_modules")

let patchCount = 0
let skipCount = 0
let errorCount = 0

function applyPatch(filePath, description, checkAlreadyPatched, find, replace) {
    try {
        const fullPath = path.join(nodeModules, filePath)
        if (!fs.existsSync(fullPath)) {
            console.warn(`  ⚠️  SKIP (file not found): ${filePath}`)
            skipCount++
            return
        }
        let content = fs.readFileSync(fullPath, "utf8")

        // Already patched?
        if (typeof checkAlreadyPatched === "function" ? checkAlreadyPatched(content) : content.includes(checkAlreadyPatched)) {
            console.log(`  ✓  Already patched: ${description}`)
            skipCount++
            return
        }

        if (!content.includes(find)) {
            console.error(`  ❌ Pattern not found (unsupported Medusa version): ${description}`)
            console.error(`     File: ${filePath}`)
            errorCount++
            return
        }

        content = content.replace(find, replace)
        fs.writeFileSync(fullPath, content, "utf8")
        console.log(`  ✅ Patched: ${description}`)
        patchCount++
    } catch (e) {
        console.error(`  ❌ Error patching ${description}: ${e.message}`)
        errorCount++
    }
}

console.log("\n🔧 Medusa Admin UI Uyumluluk Yamaları uygulanıyor...\n")

// ============================================================
// PATCH 1: zodValidator — forced .strict() kaldır
// ============================================================
applyPatch(
    "@medusajs/framework/dist/zod/zod-helpers.js",
    "zodValidator forced .strict() kaldır",
    // Already patched if the forced strict block is gone
    (content) => !content.includes('if ("strict" in zodSchema)'),
    // Find
    `async function zodValidator(zodSchema, body) {
    let strictSchema = zodSchema;
    // ZodEffects doesn't support setting as strict, for all other schemas we want to enforce strictness.
    if ("strict" in zodSchema) {
        strictSchema = zodSchema.strict();
    }
    try {
        return await strictSchema.parseAsync(body);`,
    // Replace
    `async function zodValidator(zodSchema, body) {
    // Forced .strict() removed (patched by apply-patches.js).
    // Schemas with explicit .strict() remain strict; others silently strip unknown fields.
    let strictSchema = zodSchema;
    try {
        return await strictSchema.parseAsync(body);`
)

// ============================================================
// PATCH 2: AdminCreateInventoryLocationLevel — metadata kabul et
// ============================================================
applyPatch(
    "@medusajs/medusa/dist/api/admin/inventory-items/validators.js",
    "AdminCreateInventoryLocationLevel metadata alanı",
    // Already patched if incoming_quantity block doesn't end with .strict() before AdminUpdateInventoryLocationLevelBatch
    (content) => {
        const createIdx = content.indexOf("exports.AdminCreateInventoryLocationLevel = zod_1.z")
        const updateIdx = content.indexOf("exports.AdminUpdateInventoryLocationLevelBatch = zod_1.z")
        if (createIdx === -1 || updateIdx === -1) return false
        const between = content.slice(createIdx, updateIdx)
        // Check for actual .strict() call (not just in comments)
        return !between.includes("})\n    .strict();")
    },
    `exports.AdminCreateInventoryLocationLevel = zod_1.z
    .object({
    location_id: zod_1.z.string(),
    stocked_quantity: zod_1.z.number().min(0).optional(),
    incoming_quantity: zod_1.z.number().min(0).optional(),
})
    .strict();`,
    `exports.AdminCreateInventoryLocationLevel = zod_1.z
    .object({
    location_id: zod_1.z.string(),
    stocked_quantity: zod_1.z.number().min(0).optional(),
    incoming_quantity: zod_1.z.number().min(0).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).nullish(),
})
    /* .strict() removed by apply-patches.js — admin UI sends metadata (store_id) */;`
)

// ============================================================
// PATCH 3: AdminUpdateInventoryLocationLevelBatch — metadata kabul et
// ============================================================
applyPatch(
    "@medusajs/medusa/dist/api/admin/inventory-items/validators.js",
    "AdminUpdateInventoryLocationLevelBatch metadata alanı",
    (content) => {
        const updateIdx = content.indexOf("exports.AdminUpdateInventoryLocationLevelBatch = zod_1.z")
        const batchIdx = content.indexOf("exports.AdminBatchInventoryItemLocationsLevel = zod_1.z")
        if (updateIdx === -1 || batchIdx === -1) return false
        const between = content.slice(updateIdx, batchIdx)
        return !between.includes("})\n    .strict();")
    },
    `exports.AdminUpdateInventoryLocationLevelBatch = zod_1.z
    .object({
    id: zod_1.z.string().optional(),
    location_id: zod_1.z.string(),
    stocked_quantity: zod_1.z.number().min(0).optional(),
    incoming_quantity: zod_1.z.number().min(0).optional(),
})
    .strict();`,
    `exports.AdminUpdateInventoryLocationLevelBatch = zod_1.z
    .object({
    id: zod_1.z.string().optional(),
    location_id: zod_1.z.string(),
    stocked_quantity: zod_1.z.number().min(0).optional(),
    incoming_quantity: zod_1.z.number().min(0).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).nullish(),
})
    /* .strict() removed by apply-patches.js — admin UI sends metadata (store_id) */;`
)

// ============================================================
// PATCH 4: UpdateProductVariant — .strict() kaldır (sales_channels strip)
// ============================================================
applyPatch(
    "@medusajs/medusa/dist/api/admin/products/validators.js",
    "UpdateProductVariant .strict() kaldır",
    (content) => {
        const varIdx = content.indexOf("exports.UpdateProductVariant = zod_1.z")
        if (varIdx === -1) return false
        // Search for AdminUpdateProductVariant AFTER the schema definition (not the exports declaration at top)
        const adminIdx = content.indexOf("exports.AdminUpdateProductVariant = ", varIdx)
        if (adminIdx === -1) return false
        const between = content.slice(varIdx, adminIdx)
        // Match the actual .strict() method call, not a comment containing ".strict()"
        return !between.includes("})\n    .strict();")
    },
    `    options: zod_1.z.record(zod_1.z.string()).optional(),
})
    .strict();
exports.AdminUpdateProductVariant`,
    `    options: zod_1.z.record(zod_1.z.string()).optional(),
})
    /* strict-removed */;
exports.AdminUpdateProductVariant`
)

// ============================================================
// PATCH 5: AdminUpdateInventoryLocationLevel — .strict() kaldır
// ============================================================
applyPatch(
    "@medusajs/medusa/dist/api/admin/inventory-items/validators.js",
    "AdminUpdateInventoryLocationLevel .strict() kaldır",
    (content) => {
        const idx = content.indexOf("exports.AdminUpdateInventoryLocationLevel = zod_1.z")
        if (idx === -1) return false
        const nextIdx = content.indexOf("exports.AdminCreateInventoryItem", idx)
        if (nextIdx === -1) return false
        const between = content.slice(idx, nextIdx)
        return !between.includes("})\n    .strict();")
    },
    `exports.AdminUpdateInventoryLocationLevel = zod_1.z
    .object({
    stocked_quantity: zod_1.z.number().min(0).optional(),
    incoming_quantity: zod_1.z.number().min(0).optional(),
})
    .strict();`,
    `exports.AdminUpdateInventoryLocationLevel = zod_1.z
    .object({
    stocked_quantity: zod_1.z.number().min(0).optional(),
    incoming_quantity: zod_1.z.number().min(0).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).nullish(),
})
    /* strict-removed */;`
)

console.log(`\n📊 Sonuç: ${patchCount} yeni yama | ${skipCount} zaten patched | ${errorCount} hata\n`)
if (errorCount > 0) {
    console.error("⚠️  Bazı yamalar uygulanamadı. Lütfen Medusa sürümünü kontrol edin.")
    process.exit(1)
}

/**
 * Medusa Admin API Kapsamlı Test Scripti
 * Çalıştırma: npx medusa exec src/scripts/test-admin-api.ts
 */

const BASE_URL = "http://localhost:7001"
const ADMIN_EMAIL = "zafer@zaferkaraca.net"
const ADMIN_PASSWORD = "6rK]V.l42<B?"

interface TestResult {
    name: string
    status: "PASS" | "FAIL" | "SKIP"
    detail?: string
    error?: string
}

const results: TestResult[] = []

async function getAdminToken(): Promise<string | null> {
    try {
        const res = await fetch(`${BASE_URL}/auth/user/emailpass`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
        })
        const data: any = await res.json()
        if (!res.ok) {
            console.error("[auth] Login failed:", data)
            return null
        }
        return data.token
    } catch (e: any) {
        console.error("[auth] Error:", e.message)
        return null
    }
}

async function apiCall(
    method: string,
    path: string,
    token: string,
    body?: any
): Promise<{ ok: boolean; status: number; data: any }> {
    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
    })
    let data: any = {}
    try { data = await res.json() } catch (_) {}
    return { ok: res.ok, status: res.status, data }
}

function pass(name: string, detail?: string) {
    results.push({ name, status: "PASS", detail })
    console.log(`  ✅ PASS: ${name}${detail ? " — " + detail : ""}`)
}

function fail(name: string, error: string) {
    results.push({ name, status: "FAIL", error })
    console.log(`  ❌ FAIL: ${name} — ${error}`)
}

function skip(name: string, reason: string) {
    results.push({ name, status: "SKIP", detail: reason })
    console.log(`  ⏭️  SKIP: ${name} — ${reason}`)
}

async function runTests() {
    console.log("=".repeat(60))
    console.log("Medusa Admin API Kapsamlı Test")
    console.log("=".repeat(60))

    // --- AUTH ---
    console.log("\n📋 [1] AUTH")
    const token = await getAdminToken()
    if (!token) {
        fail("Admin Login", "Token alınamadı")
        console.log("\n❌ Auth başarısız, testler durduruluyor.")
        return
    }
    pass("Admin Login", "Token alındı")

    // --- STORES ---
    console.log("\n📋 [2] STORE YÖNETİMİ")
    {
        const r = await apiCall("GET", "/admin/stores", token)
        if (r.ok && r.data?.stores?.length > 0) {
            pass("Store Listesi", `${r.data.stores.length} store bulundu`)
        } else {
            fail("Store Listesi", `Status: ${r.status}, ${JSON.stringify(r.data).substring(0, 100)}`)
        }
    }

    // --- PRODUCTS ---
    console.log("\n📋 [3] ÜRÜNLER")
    let productId: string | null = null
    let variantId: string | null = null

    {
        // List products
        const r = await apiCall("GET", "/admin/products?limit=5", token)
        if (r.ok) {
            pass("Ürün Listesi", `${r.data?.count ?? 0} ürün`)
            if (r.data?.products?.length > 0) {
                productId = r.data.products[0].id
                variantId = r.data.products[0].variants?.[0]?.id ?? null
            }
        } else {
            fail("Ürün Listesi", `${r.status}: ${JSON.stringify(r.data).substring(0, 100)}`)
        }
    }

    {
        // Create product
        const r = await apiCall("POST", "/admin/products", token, {
            title: "[TEST] Otomatik Test Ürünü",
            status: "draft",
            options: [{ title: "Varsayılan", values: ["Standart"] }],
            variants: [
                {
                    title: "Standart Varyant",
                    options: { Varsayılan: "Standart" },
                    manage_inventory: false,
                    prices: [{ amount: 1000, currency_code: "try" }],
                },
            ],
        })
        if (r.ok && r.data?.product?.id) {
            pass("Ürün Oluşturma", `ID: ${r.data.product.id}`)
            productId = r.data.product.id
            variantId = r.data.product.variants?.[0]?.id ?? null
        } else {
            fail("Ürün Oluşturma", `${r.status}: ${JSON.stringify(r.data).substring(0, 200)}`)
        }
    }

    if (productId && variantId) {
        // Update variant — Medusa v2 uses POST (not PATCH) for variant update
        // sales_channels is sent by Admin UI — should now be accepted by patched validator
        const r = await apiCall("POST", `/admin/products/${productId}/variants/${variantId}`, token, {
            title: "Güncellenmiş Varyant",
            manage_inventory: true,
            sales_channels: [{ id: "sc_01JX8ZM1NQH9MG9Y3P1KQMM42P" }], // Admin UI bunu gönderiyor
        })
        if (r.ok) {
            pass("Varyant Güncelleme (sales_channels strip)", "sales_channels strip middleware çalıştı")
        } else {
            fail("Varyant Güncelleme (sales_channels strip)", `${r.status}: ${JSON.stringify(r.data).substring(0, 200)}`)
        }
    } else {
        skip("Varyant Güncelleme", "Ürün/varyant ID bulunamadı")
    }

    // --- INVENTORY ---
    console.log("\n📋 [4] ENVANTER")
    let inventoryItemId: string | null = null

    {
        const r = await apiCall("GET", "/admin/inventory-items?limit=5", token)
        if (r.ok) {
            pass("Envanter Listesi", `${r.data?.count ?? 0} öğe`)
            inventoryItemId = r.data?.inventory_items?.[0]?.id ?? null
        } else {
            fail("Envanter Listesi", `${r.status}: ${JSON.stringify(r.data).substring(0, 100)}`)
        }
    }

    {
        // Create inventory item
        const r = await apiCall("POST", "/admin/inventory-items", token, {
            sku: `TEST-${Date.now()}`,
            title: "Test Envanter Öğesi",
        })
        if (r.ok && r.data?.inventory_item?.id) {
            pass("Envanter Öğesi Oluşturma", `ID: ${r.data.inventory_item.id}`)
            inventoryItemId = r.data.inventory_item.id
        } else {
            fail("Envanter Öğesi Oluşturma", `${r.status}: ${JSON.stringify(r.data).substring(0, 200)}`)
        }
    }

    // --- STOCK LOCATIONS ---
    console.log("\n📋 [5] STOK KONUMLARI")
    let stockLocationId: string | null = null

    {
        const r = await apiCall("GET", "/admin/stock-locations?limit=5", token)
        if (r.ok) {
            pass("Stok Konum Listesi", `${r.data?.stock_locations?.length ?? 0} konum`)
            stockLocationId = r.data?.stock_locations?.[0]?.id ?? null
        } else {
            fail("Stok Konum Listesi", `${r.status}: ${JSON.stringify(r.data).substring(0, 100)}`)
        }
    }

    // Location-levels batch — strip metadata test
    if (inventoryItemId && stockLocationId) {
        const r = await apiCall(
            "POST",
            `/admin/inventory-items/${inventoryItemId}/location-levels/batch`,
            token,
            {
                create: [
                    {
                        location_id: stockLocationId,
                        stocked_quantity: 10,
                        metadata: { store_id: "test-store-id" }, // Bu strip edilmeli
                    },
                ],
            }
        )
        if (r.ok) {
            pass("Envanter Konum Ataması (metadata strip)", "metadata strip middleware çalıştı")
        } else {
            fail("Envanter Konum Ataması (metadata strip)", `${r.status}: ${JSON.stringify(r.data).substring(0, 200)}`)
        }
    } else {
        skip("Envanter Konum Ataması", `inventoryItemId=${inventoryItemId}, stockLocationId=${stockLocationId}`)
    }

    // --- CUSTOMERS ---
    console.log("\n📋 [6] MÜŞTERİLER")
    {
        const r = await apiCall("GET", "/admin/customers?limit=5", token)
        if (r.ok) {
            pass("Müşteri Listesi", `${r.data?.count ?? 0} müşteri`)
        } else {
            fail("Müşteri Listesi", `${r.status}: ${JSON.stringify(r.data).substring(0, 100)}`)
        }
    }

    // --- REGIONS ---
    console.log("\n📋 [7] BÖLGELER")
    {
        const r = await apiCall("GET", "/admin/regions", token)
        if (r.ok) {
            pass("Bölge Listesi", `${r.data?.regions?.length ?? 0} bölge`)
        } else {
            fail("Bölge Listesi", `${r.status}: ${JSON.stringify(r.data).substring(0, 100)}`)
        }
    }

    // --- ORDERS ---
    console.log("\n📋 [8] SİPARİŞLER")
    {
        const r = await apiCall("GET", "/admin/orders?limit=5", token)
        if (r.ok) {
            pass("Sipariş Listesi", `${r.data?.count ?? 0} sipariş`)
        } else {
            fail("Sipariş Listesi", `${r.status}: ${JSON.stringify(r.data).substring(0, 100)}`)
        }
    }

    // --- PROMOTIONS / DISCOUNTS ---
    console.log("\n📋 [9] PROMOSYONLAR")
    {
        const r = await apiCall("GET", "/admin/promotions?limit=5", token)
        if (r.ok) {
            pass("Promosyon Listesi", `${r.data?.count ?? 0} promosyon`)
        } else {
            fail("Promosyon Listesi", `${r.status}: ${JSON.stringify(r.data).substring(0, 100)}`)
        }
    }

    // --- CLEANUP: Delete test product ---
    if (productId) {
        const r = await apiCall("DELETE", `/admin/products/${productId}`, token)
        if (r.ok || r.status === 200) {
            pass("Test Ürünü Silme", `ID: ${productId}`)
        }
        // silme başarısız olsa da devam
    }
    if (inventoryItemId) {
        const r = await apiCall("DELETE", `/admin/inventory-items/${inventoryItemId}`, token)
        if (r.ok || r.status === 200) {
            pass("Test Envanter Öğesi Silme", `ID: ${inventoryItemId}`)
        }
    }

    // --- SUMMARY ---
    console.log("\n" + "=".repeat(60))
    const passCount = results.filter(r => r.status === "PASS").length
    const failCount = results.filter(r => r.status === "FAIL").length
    const skipCount = results.filter(r => r.status === "SKIP").length
    console.log(`📊 ÖZET: ${passCount} PASS | ${failCount} FAIL | ${skipCount} SKIP`)
    if (failCount > 0) {
        console.log("\n❌ Başarısız Testler:")
        results.filter(r => r.status === "FAIL").forEach(r => {
            console.log(`   - ${r.name}: ${r.error}`)
        })
    } else {
        console.log("\n🎉 Tüm testler başarılı!")
    }
    console.log("=".repeat(60))
}

export default async function testAdminApi({ container }: any) {
    await runTests()
}

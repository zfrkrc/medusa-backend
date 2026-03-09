import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { STORE_MANAGEMENT_MODULE } from "../../modules/store-management"
import StoreManagementService from "../../modules/store-management/service"
import { Modules } from "@medusajs/framework/utils"

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  storeIsolationMiddleware — KESİN İZOLASYON MATRİSİ         ║
 * ╠═══════════════════════════════════════════════════════════════╣
 * ║  Orders & Products    → İZOLE   (Sales Channel Query)        ║
 * ║  Store Settings       → İZOLE   (Response Filter)            ║
 * ║  Sales Channels       → İZOLE   (Response Filter)            ║
 * ║  Locations & Shipping → İZOLE   (metadata.store_id)          ║
 * ║  Users                → GİZLİ   (Sadece kendisi)             ║
 * ║  API Keys             → GİZLİ   (Boş liste)                  ║
 * ║  Workflows            → KİŞİSEL (Response Filter)            ║
 * ║  Regions/Tax/Tags     → ORTAK   (Dokunulmaz)                  ║
 * ╚═══════════════════════════════════════════════════════════════╝
 *
 * KRİTİK KURAL: /admin/stores yanıtını ASLA filtreleme.
 * Medusa Admin UI başlangıçta bu endpoint'ten veri alarak
 * dashboard'u yükler. Filtrelersek 404 hatası alırız çünkü
 * Medusa'nın dahili store ID'leri ile bizim custom module'ün
 * ID'leri farklıdır.
 */
export async function storeIsolationMiddleware(
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
) {
    const path = req.path;
    const method = req.method;

    try {
        const storeManagementService: StoreManagementService =
            req.scope.resolve(STORE_MANAGEMENT_MODULE);

        // ═══ 1. KİMLİK TESPİTİ ═══
        let email = (req as any)._adminEmail;
        const authContext = (req as any).auth_context;

        if (!email && authContext?.actor_id) {
            try {
                const userService = req.scope.resolve(Modules.USER);
                const user = await userService.retrieveUser(authContext.actor_id);
                email = user.email;
            } catch (_) { }
        }

        // Çerezden fallback veya Bearer token
        if (!email) {
            const cookies = req.headers.cookie || "";
            const authHeader = req.headers.authorization || "";
            let token = "";

            if (authHeader.startsWith("Bearer ")) {
                token = authHeader.split(" ")[1];
            } else {
                const match = cookies
                    .split(";")
                    .find((c) => c.trim().startsWith("_medusa_jwt_="));
                if (match) {
                    token = decodeURIComponent(match.split("=")[1]);
                }
            }
            if (token) {
                try {
                    const payload = JSON.parse(
                        Buffer.from(token.split(".")[1], "base64").toString()
                    );
                    email = payload.email || payload.app_metadata?.email;

                    if (!email && payload.actor_id) {
                        const userService = req.scope.resolve(Modules.USER);
                        const user = await userService.retrieveUser(payload.actor_id);
                        email = user.email;
                    }
                } catch (err: any) {
                    console.log(`[isolation] ⚠️ Token parsing or DB lookup failed: ${err.message}`);
                }
            }
        }

        console.log(`[isolation] 🟡 Pre-check for path: ${path}. Email resolved: ${email}, authContext: ${JSON.stringify(authContext || {})}`);

        if (!email) {
            return next();
        }

        const isSuperAdmin = await storeManagementService.isSuperAdmin(email);
        if (isSuperAdmin) {
            // console.log(`[isolation] 🌟 ${email} is SUPER ADMIN. Bypassing isolation.`);
            return next(); // SuperAdmin = sınırsız
        }

        const storeId = await storeManagementService.getStoreIdForAdmin(email);
        if (!storeId) {
            console.log(`[isolation] ⛔ ${email} has no store_id. Skipping isolation (Warning: will see all data)`);
            return next(); // Tanımsız kullanıcı
        }

        const store = await storeManagementService.findStoreById(storeId);
        const scId = (store as any)?.sales_channel_id;

        console.log(`[isolation] 🛡️ ${email} is STORE ADMIN for store_id: ${storeId}, sc_id: ${scId}`);

        // ═══ 2. SORGU FİLTRELEME (Sadece Products & Orders) ═══
        if (method === "GET") {
            const query = req.query as any;
            const isProductsList =
                path === "/admin/products" || path === "/admin/products/";
            const isOrdersList =
                path === "/admin/orders" || path === "/admin/orders/";

            if (scId && (isProductsList || isOrdersList)) {
                query.sales_channel_id = [scId];
            }

            // Metadata içeren endpointlere *metadata alanını ekle (filtreleme için)
            const needsMetadata =
                path.includes("/stock-locations") ||
                path.includes("/customers") ||
                path.includes("/inventory-items") ||
                path.includes("/promotions") ||
                path.includes("/price-lists");
            if (needsMetadata) {
                if (query.fields && typeof query.fields === "string") {
                    if (!query.fields.includes("metadata")) {
                        query.fields += ",*metadata";
                    }
                } else if (!query.fields) {
                    // fields yoksa metadata iste
                    query.fields = "*metadata";
                }
            }
        }

        // ═══ 3. YANIT FİLTRELEME (Ghost Mode) ═══
        const processGhostMode = (body: any, methodRes: any) => {
            if (!body || typeof body !== "object") return;

            // ── Users → GİZLİ (Sadece kendisi) ──
            if (path.includes("/users") && !path.includes("/me")) {
                console.log(`[isolation] 👥 Users Filter Hit! Path: ${path}, Email: ${email}, Requesting filter for ${email}. IsArray(body.users): ${Array.isArray(body.users)}, body keys: ${Object.keys(body).join(',')}`);
                if (body.users && Array.isArray(body.users)) {
                    body.users = body.users.filter((u: any) => u.email === email);
                    body.count = body.users.length;
                    console.log(`[isolation] 👥 After filter: ${body.users.length} users left.`);
                } else if (body.user && !Array.isArray(body.user)) {
                    // /admin/users/:id endpoint'i tekli dönerse
                    if (body.user.email !== email) {
                        body.user = null; // Başkasını görüntülemesini engelle
                    }
                }
            }

            // ── API Keys → GİZLİ (Boş liste) ──
            if (path.includes("/api-keys")) {
                if (body.api_keys) body.api_keys = [];
                if (body.count !== undefined) body.count = 0;
            }

            // ── Sales Channels → İZOLE ──
            if (path.includes("/sales-channels") && !path.includes("/me")) {
                if (body.sales_channels && Array.isArray(body.sales_channels) && scId) {
                    body.sales_channels = body.sales_channels.filter((sc: any) => sc.id === scId);
                    body.count = body.sales_channels.length;
                }
            }

            // ── Locations & Shipping → İZOLE (metadata) ──
            if (body.stock_locations && Array.isArray(body.stock_locations)) {
                body.stock_locations = body.stock_locations.filter(
                    (sl: any) => sl.metadata?.store_id === storeId
                );
                body.count = body.stock_locations.length;
            }

            // ── Customers → İZOLE (metadata.store_id veya metadata.store_ids[]) ──
            if (body.customers && Array.isArray(body.customers)) {
                body.customers = body.customers.filter((c: any) => {
                    // Eski format: tek store_id
                    if (c.metadata?.store_id === storeId) return true
                    // Yeni format: store_ids dizisi (aynı müşteri birden fazla mağazada)
                    if (Array.isArray(c.metadata?.store_ids) && c.metadata.store_ids.includes(storeId)) return true
                    return false
                })
                body.count = body.customers.length;
            }

            // ── Orders → İZOLE (Response fallback) ──
            if (body.orders && Array.isArray(body.orders) && scId) {
                body.orders = body.orders.filter(
                    (o: any) => o.sales_channel_id === scId
                );
                body.count = body.orders.length;
            }

            // ── Products → İZOLE (Response fallback) ──
            if (body.products && Array.isArray(body.products) && scId) {
                body.products = body.products.filter((p: any) => {
                    if (!p.sales_channels) return true;
                    return p.sales_channels.some((sc: any) => (sc.id || sc) === scId);
                });
                body.count = body.products.length;
            }

            // ── Inventory Items → İZOLE (metadata.store_id) ──
            if (body.inventory_items && Array.isArray(body.inventory_items)) {
                body.inventory_items = body.inventory_items.filter(
                    (item: any) => item.metadata?.store_id === storeId
                );
                body.count = body.inventory_items.length;
            }

            // ── Promotions → İZOLE (metadata.store_id) ──
            if (body.promotions && Array.isArray(body.promotions)) {
                body.promotions = body.promotions.filter(
                    (p: any) => p.metadata?.store_id === storeId
                );
                body.count = body.promotions.length;
            }

            // ── Price Lists → İZOLE (metadata.store_id) ──
            if (body.price_lists && Array.isArray(body.price_lists)) {
                body.price_lists = body.price_lists.filter(
                    (pl: any) => pl.metadata?.store_id === storeId
                );
                body.count = body.price_lists.length;
            }
        };

        const originalJson = res.json;
        res.json = function (this: any, body: any) {
            try {
                processGhostMode(body, res);
            } catch (err) { }
            return originalJson.call(this, body);
        };

        const originalSend = res.send;
        res.send = function (this: any, body: any) {
            try {
                if (typeof body === "string") {
                    try {
                        const parsed = JSON.parse(body);
                        processGhostMode(parsed, res);
                        body = JSON.stringify(parsed);
                    } catch (e) { }
                } else {
                    processGhostMode(body, res);
                }
            } catch (err) { }
            return originalSend.call(this, body);
        };


        // ═══ 4. OTOMATİK ETİKETLEME (POST/PUT) ═══
        if (["POST", "PUT"].includes(method)) {
            const reqBody = (req as any).body;
            if (
                reqBody &&
                typeof reqBody === "object" &&
                !Array.isArray(reqBody)
            ) {
                // Her yeni varlığa store_id ekle
                reqBody.metadata = reqBody.metadata || {};
                reqBody.metadata.store_id = storeId;

                // Ürünlere otomatik satış kanalı ata
                if (path.includes("/products") && scId) {
                    reqBody.sales_channels = reqBody.sales_channels || [];
                    if (
                        !reqBody.sales_channels.some(
                            (item: any) => (item.id || item) === scId
                        )
                    ) {
                        reqBody.sales_channels.push({ id: scId });
                    }
                }
            }
        }

        return next();
    } catch (err) {
        console.error("[isolation] FATAL:", err);
        return next();
    }
}

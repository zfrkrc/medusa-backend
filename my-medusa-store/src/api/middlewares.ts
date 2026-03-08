import { defineMiddlewares } from "@medusajs/medusa"
import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { storeIsolationMiddleware } from "./middlewares/store-isolation"
import { authContextMiddleware, publicStoreHeaderMiddleware } from "./middlewares/auth-context"

// ============================================================
// Cookie Auth Patch artık instrumentation.ts içinde.
// (Medusa route kayıtlarından ÖNCE çalışması için oraya taşındı)
// ============================================================

export default defineMiddlewares({
    routes: [
        // ===== SESSION COOKIE WRITER — Login =====
        {
            method: ["POST"],
            matcher: "/auth/session",
            bodyParser: { sizeLimit: "2mb" }, // ensure body is parsed
            middlewares: [
                (req: any, res: any, next: any) => {
                    console.log(`[cookie-auth] 🔍 POST /auth/session Intercepted! body exist: ${!!req.body}`)
                    if (req.body) console.log(JSON.stringify(req.body).substring(0, 100))

                    let token = req.headers.authorization?.replace("Bearer ", "").trim()

                    if (!token && req.body?.token) {
                        token = req.body.token.trim()
                        // Ensure it drops into Medusa context
                        req.headers.authorization = `Bearer ${token}`
                        console.log(`[cookie-auth] 🔧 Injected Authorization header from req.body`)
                    } else if (!token && !req.body && req.on) {
                        console.log(`[cookie-auth] 🚧 req.body is missing, body parser hasn't run yet?`)
                    }

                    if (token) {
                        try {
                            const cookieStr = `_medusa_jwt_=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${10 * 60 * 60}`
                            res.setHeader("Set-Cookie", cookieStr)
                            console.log("[cookie-auth] 🍪 Successfully wrote _medusa_jwt_ cookie on POST /auth/session")
                        } catch (_) { }
                    }
                    next()
                }
            ]
        },

        // ===== SESSION COOKIE CLEARER — Logout =====
        {
            method: ["DELETE"],
            matcher: "/auth/session",
            middlewares: [
                (req: any, res: any) => {
                    console.log("[cookie-auth] 🗑️ Wiping out _medusa_jwt_ on DELETE /auth/session")
                    res.setHeader("Set-Cookie", [
                        `_medusa_jwt_=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
                        `_medusa_jwt_=; Path=/; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
                    ])
                    res.status(200).json({ success: true, message: "Custom logout successful" })
                }
            ]
        },

        // Strip 'metadata' from inventory location-level batch requests
        // (Admin UI sends metadata but Medusa 2.x API uses .strict() schema)
        {
            method: ["POST"],
            matcher: "/admin/inventory-items/:id/location-levels/batch",
            middlewares: [
                (req: any, _res: any, next: any) => {
                    const strip = ({ metadata: _m, ...rest }: any) => rest
                    if (req.body?.create?.length) req.body.create = req.body.create.map(strip)
                    if (req.body?.update?.length) req.body.update = req.body.update.map(strip)
                    next()
                }
            ]
        },

        // Strip 'sales_channels' from product variant create/update
        // (Admin UI sends sales_channels but Medusa 2.x variant schema is .strict())
        {
            method: ["POST", "PATCH"],
            matcher: "/admin/products/:id/variants/:variant_id",
            middlewares: [
                (req: any, _res: any, next: any) => {
                    if (req.body?.sales_channels !== undefined) {
                        delete req.body.sales_channels
                    }
                    next()
                }
            ]
        },

        // Strip 'sales_channels' from product variant batch create
        {
            method: ["POST"],
            matcher: "/admin/products/:id/variants",
            middlewares: [
                (req: any, _res: any, next: any) => {
                    if (Array.isArray(req.body)) {
                        req.body = req.body.map(({ sales_channels: _sc, ...rest }: any) => rest)
                    } else if (req.body?.sales_channels !== undefined) {
                        delete req.body.sales_channels
                    }
                    next()
                }
            ]
        },

        // Strip unknown fields from product batch upsert
        {
            method: ["POST"],
            matcher: "/admin/products/batch",
            middlewares: [
                (req: any, _res: any, next: any) => {
                    const cleanVariant = ({ sales_channels: _sc, ...rest }: any) => rest
                    if (req.body?.create?.length) {
                        req.body.create = req.body.create.map((p: any) => ({
                            ...p,
                            variants: p.variants?.map(cleanVariant),
                        }))
                    }
                    if (req.body?.update?.length) {
                        req.body.update = req.body.update.map((p: any) => ({
                            ...p,
                            variants: p.variants?.map(cleanVariant),
                        }))
                    }
                    next()
                }
            ]
        },

        // Runs after Medusa's built-in authenticate() so auth_context is available.
        {
            method: ["GET", "POST", "PUT", "PATCH", "DELETE"],
            matcher: "/admin/*",
            middlewares: [
                authContextMiddleware,
                storeIsolationMiddleware,
            ],
        },

        // ===== PUBLIC STORE HEADER — Store API Routes =====
        // Storefront sends "x-store-handle: clay-store" to scope its data.
        {
            method: ["GET", "POST", "PUT", "PATCH", "DELETE"],
            matcher: "/store/*",
            middlewares: [
                publicStoreHeaderMiddleware,
            ],
        },

        // ===== ADMIN REQUEST DEBUG =====
        {
            method: ["GET"],
            matcher: "/admin/users/me",
            middlewares: [
                (req: any, res: any, next: any) => {
                    const hasAuth = !!req.headers.authorization
                    const hasCookie = !!req.headers.cookie
                    const hasJwtCookie = hasCookie && req.headers.cookie.includes('_medusa_jwt_=')
                    console.log(`[admin-debug] GET /admin/users/me | auth:${hasAuth} | cookie:${hasCookie} | jwtCookie:${hasJwtCookie}`)
                    if (hasAuth) {
                        console.log(`[admin-debug]   Auth: ${req.headers.authorization.substring(0, 40)}...`)
                    }
                    next()
                }
            ]
        },
        // ===== END DEBUG =====
        {
            method: ["GET"],
            matcher: "/uploads-debug",
            middlewares: [
                (req: MedusaRequest, res: MedusaResponse) => {
                    const fs = require("fs")
                    const path = require("path")

                    const possiblePaths = [
                        "/app/my-medusa-store/uploads",
                        "/app/uploads",
                        path.join(process.cwd(), "uploads"),
                        path.join(process.cwd(), "public/uploads"),
                        // Bir ust klasorleri de kontrol et
                        path.join(process.cwd(), "../uploads"),
                        path.join(process.cwd(), "../../uploads")
                    ]

                    const result: any = {}

                    possiblePaths.forEach(p => {
                        try {
                            if (fs.existsSync(p)) {
                                result[p] = fs.readdirSync(p)
                            } else {
                                result[p] = "Directory does not exist"
                            }
                        } catch (e: any) {
                            result[p] = `Error: ${e.message}`
                        }
                    })

                    res.json({
                        cwd: process.cwd(),
                        userInfo: require("os").userInfo(),
                        files: result
                    })
                }
            ]
        },
        {
            method: ["GET"],
            matcher: "/uploads/*",
            middlewares: [
                (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
                    const fs = require("fs")
                    const path = require("path")

                    // 1. URL Temizleme
                    let filename = req.path.replace(/^\/uploads\//, "").replace(/^\/uploads/, "").replace(/^\//, "").split("?")[0]
                    // Decode islemi
                    const decodedFilename = decodeURIComponent(filename)

                    const uploadDir = "/app/my-medusa-store/uploads"

                    // 2. Dosya Arama (Fuzzy Match / Esnek Arama)
                    let foundPath = null

                    // Once direkt bak
                    if (fs.existsSync(path.join(uploadDir, filename))) {
                        foundPath = path.join(uploadDir, filename)
                    } else if (fs.existsSync(path.join(uploadDir, decodedFilename))) {
                        foundPath = path.join(uploadDir, decodedFilename)
                    } else {
                        // Klasoru tara
                        try {
                            const files = fs.readdirSync(uploadDir)
                            for (const f of files) {
                                // Birebir, decode edilmis veya encode edilmis hali tutuyor mu?
                                if (f === filename || f === decodedFilename || encodeURIComponent(f) === filename) {
                                    foundPath = path.join(uploadDir, f)
                                    break
                                }
                            }
                        } catch (e) { console.error("Dir Error:", e) }
                    }

                    // CORS Headerlari (Onemli)
                    res.set("Cross-Origin-Resource-Policy", "cross-origin")
                    res.set("Access-Control-Allow-Origin", "*")

                    if (foundPath) {
                        // 3. DOSYA STREAMING (Nukleer Yontem - En Garantisi)
                        try {
                            // Content Type tahmin etmeye calisalim (basitce)
                            if ((foundPath as string).endsWith(".jpg") || (foundPath as string).endsWith(".jpeg")) res.set("Content-Type", "image/jpeg")
                            else if ((foundPath as string).endsWith(".png")) res.set("Content-Type", "image/png")
                            else if ((foundPath as string).endsWith(".webp")) res.set("Content-Type", "image/webp")

                            const stream = fs.createReadStream(foundPath)
                            stream.on("error", (err: Error) => {
                                console.error("Stream Error:", err)
                                res.status(500).send("Stream Error")
                            })
                            stream.pipe(res)
                        } catch (err) {
                            console.error("Pipe Error:", err)
                            res.status(500).send("Pipe Error")
                        }
                    } else {
                        // BULUNAMADI - Debug modu: Klasor icerigini goster
                        console.error(`[Static Serve] Not Found: ${filename}`)
                        try {
                            const dirContent = fs.readdirSync(uploadDir)
                            res.status(404).json({
                                error: "File not found",
                                requested: filename,
                                decoded: decodedFilename,
                                availableFiles: dirContent
                            })
                        } catch (e) {
                            res.status(404).send("File not found and cannot scan directory")
                        }
                    }
                }
            ],
        },
    ],
})

/**
 * Medusa Instrumentation Hook
 * 
 * Bu dosya, Medusa başlamadan ÖNCE çalışır (–require veya Node.js register aracılığıyla).
 * Bu sayede authenticate middleware'i, route'lar kaydedilmeden ÖNCE patch'lenebilir.
 * 
 * Neden burada?
 * - middlewares.ts: Route kayıtlarından SONRA yüklenir → patch çalışır ama route'lar
 *   zaten orijinal authenticate() referansını almış olur.
 * - instrumentation.ts: Her şeyden ÖNCE yüklenir → patch route kayıtlarından önce devreye girer.
 */

import path from "path"

// ============================================================
// COOKIE AUTH PATCH
// _medusa_jwt_ cookie'sindeki JWT'yi Authorization header'a çevirir.
// Admin panel page refresh sonrası oturum kaybını önler.
// ============================================================
function patchCookieAuth() {
    try {
        const authModulePath = path.join(
            process.cwd(),
            "node_modules", "@medusajs", "framework",
            "dist", "http", "middlewares", "authenticate-middleware"
        )

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const authModule = require(authModulePath)

        // Çift patch'lemeyi engelle
        if (authModule.authenticate?.__cookiePatched) {
            console.log("[cookie-auth] ⏭️  Already patched, skipping")
            return
        }

        const originalAuthenticate = authModule.authenticate

        authModule.authenticate = function (...args: any[]) {
            const originalMiddleware = originalAuthenticate(...args)

            return async function (req: any, res: any, next: any) {
                // Cookie'den JWT oku, Authorization header yoksa ekle
                if (!req.headers.authorization && req.headers.cookie) {
                    const cookies: string = req.headers.cookie
                    const match = cookies
                        .split(";")
                        .find((c: string) => c.trim().startsWith("_medusa_jwt_="))

                    if (match) {
                        const token = decodeURIComponent(
                            match.split("=").slice(1).join("=").trim()
                        )
                        if (token) {
                            req.headers.authorization = `Bearer ${token}`
                            console.log(`[cookie-auth] 🍪→🔑 Cookie'den token inject edildi: ${req.method} ${req.path}`)
                        }
                    }
                }

                return originalMiddleware(req, res, next)
            }
        }

        authModule.authenticate.__cookiePatched = true
        console.log("[cookie-auth] ✅ Auth middleware patched (instrumentation.ts)")
    } catch (e: any) {
        console.error("[cookie-auth] ❌ Patch failed:", e.message)
    }
}

// register() Medusa tarafından en erken aşamada çağrılır
export function register() {
    patchCookieAuth()
}
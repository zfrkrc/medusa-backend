/**
 * Cookie Auth Loader
 * 
 * Medusa v2 framework'ünün authenticate middleware'i, custom defineMiddlewares
 * middleware'lerinden ÖNCE çalışır. Bu loader, authenticate fonksiyonunu
 * patch'leyerek cookie'deki JWT'yi Authorization header'a ekler.
 * 
 * Akış:
 * 1. Loader startup'ta çalışır (route'lar yüklenmeden önce)
 * 2. authenticate fonksiyonu patch'lenir
 * 3. Her admin isteğinde: cookie okunur → Bearer token eklenir → orijinal auth çalışır
 */

export default async function cookieAuthLoader() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const authModule = require("@medusajs/framework/dist/http/middlewares/authenticate-middleware")
        const originalAuthenticate = authModule.authenticate

        authModule.authenticate = function (...args: any[]) {
            const originalMiddleware = originalAuthenticate(...args)

            return async function (req: any, res: any, next: any) {
                // Cookie'den JWT oku ve Authorization header'a ekle
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
                        }
                    }
                }

                // Orijinal authenticate middleware'i çalıştır
                return originalMiddleware(req, res, next)
            }
        }

        console.log("[cookie-auth] ✅ Auth middleware patched for cookie support")
    } catch (e: any) {
        console.error("[cookie-auth] ❌ Failed to patch auth middleware:", e.message)
    }
}

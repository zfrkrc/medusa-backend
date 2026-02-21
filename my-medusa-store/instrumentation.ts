import path from "path"

function patchAuthenticateModule(modulePath: string, label: string) {
    try {
        const fullPath = path.isAbsolute(modulePath)
            ? modulePath
            : path.join(process.cwd(), "node_modules", modulePath)

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const authModule = require(fullPath)

        if (!authModule || !authModule.authenticate) {
            return false
        }

        if (authModule.authenticate.__cookiePatched) {
            console.log(`[cookie-auth] ⏭️  ${label} already patched`)
            return true
        }

        const originalAuthenticate = authModule.authenticate

        authModule.authenticate = function (...args: any[]) {
            const originalMiddleware = originalAuthenticate(...args)

            return async function (req: any, res: any, next: any) {
                // Her istekte bir kez log atalım (debug için)
                if (req.path?.includes('users/me')) {
                    console.log(`[cookie-auth] 📍 Intercepted: ${req.method} ${req.path} (via ${label})`)
                }

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
                            console.log(`[cookie-auth] 🍪→🔑 Token injected from cookie`)
                        }
                    }
                }
                return originalMiddleware(req, res, next)
            }
        }

        authModule.authenticate.__cookiePatched = true
        console.log(`[cookie-auth] ✅ Patched: ${label}`)
        return true
    } catch (e: any) {
        // Hata verirse sadece logla, uygulamayı durdurma
        return false
    }
}

export function register() {
    console.log("[cookie-auth] Starting patch process...")

    // Olası tüm lokasyonları patch'le
    // grep çıktısına göre @medusajs/medusa paketindeki yol: dist/api/utils/middlewares/authenticate-middleware
    const paths = [
        "@medusajs/framework/dist/http/middlewares/authenticate-middleware",
        "@medusajs/medusa/dist/api/utils/middlewares/authenticate-middleware",
        "@medusajs/medusa/dist/http/middlewares/authenticate-middleware"
    ]

    paths.forEach(p => patchAuthenticateModule(p, p))
}

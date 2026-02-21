import { defineMiddlewares } from "@medusajs/medusa"
import path from "path"

// ============================================================
// Cookie Auth Patch artık instrumentation.ts içinde.
// (Medusa route kayıtlarından ÖNCE çalışması için oraya taşındı)
// ============================================================

// Helper: Cookie'den değer okuma (cookie-parser gerektirmez)
function getCookieValue(req: any, name: string): string | null {
    const cookieHeader = req.headers.cookie
    if (!cookieHeader) return null
    const match = cookieHeader.split(';').find((c: string) => c.trim().startsWith(name + '='))
    if (!match) return null
    return decodeURIComponent(match.split('=').slice(1).join('=').trim())
}

export default defineMiddlewares({
    routes: [
        // ===== SESSION COOKIE WRITER =====
        // /auth/session POST → JWT'yi HTTP-only cookie olarak set et
        // (Cookie reader artık src/loaders/cookie-auth.ts tarafından framework seviyesinde yapılıyor)
        {
            method: ["POST"],
            matcher: "/auth/session",
            middlewares: [
                (req: any, res: any, next: any) => {
                    const token = req.headers.authorization?.replace('Bearer ', '')
                    if (token) {
                        const origWriteHead = res.writeHead
                        res.writeHead = function (statusCode: number, ...args: any[]) {
                            if (statusCode >= 200 && statusCode < 300) {
                                res.setHeader('Set-Cookie',
                                    `_medusa_jwt_=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${10 * 60 * 60}`
                                )
                            }
                            return origWriteHead.call(res, statusCode, ...args)
                        }
                    }
                    next()
                }
            ]
        },
        // ===== END SESSION COOKIE =====
        {
            method: ["GET"],
            matcher: "/uploads-debug",
            middlewares: [
                (req, res) => {
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
                (req, res, next) => {
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

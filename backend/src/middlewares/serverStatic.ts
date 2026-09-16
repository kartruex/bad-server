import { NextFunction, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

const CACHE_CONTROL = 'public, max-age=86400'

export default function serveStatic(baseDir: string) {
    const root = path.resolve(baseDir)

    return (req: Request, res: Response, next: NextFunction) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next()
        }

        let requestedPath: string
        try {
            requestedPath = decodeURIComponent(req.path)
        } catch {
            return next()
        }

        // Нулевой байт обрывает строку в системных вызовах и обходит проверки пути
        if (requestedPath.includes('\0')) {
            return next()
        }

        // path.resolve схлопывает '..', поэтому проверяем результат, а не исходную строку
        const filePath = path.resolve(
            root,
            `.${path.posix.normalize(requestedPath)}`
        )
        if (filePath !== root && !filePath.startsWith(root + path.sep)) {
            return next()
        }

        return fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                return next()
            }
            res.setHeader('Cache-Control', CACHE_CONTROL)
            return res.sendFile(filePath, (sendErr) => {
                if (sendErr) {
                    next(sendErr)
                }
            })
        })
    }
}

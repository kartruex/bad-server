import { NextFunction, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { RATE_LIMIT } from '../config'

// Выдача CSRF-токена не ходит в базу и нужна перед каждой мутацией,
// поэтому у неё отдельный, более щедрый лимит
const CSRF_TOKEN_PATH = '/auth/csrf-token'

const apiLimiter = rateLimit({
    windowMs: RATE_LIMIT.durationSec * 1000,
    limit: RATE_LIMIT.points,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => req.path === CSRF_TOKEN_PATH,
    message: { message: 'Слишком много запросов, попробуйте позже' },
})

const csrfTokenLimiter = rateLimit({
    windowMs: RATE_LIMIT.durationSec * 1000,
    limit: Math.max(RATE_LIMIT.points * 10, 100),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => req.path !== CSRF_TOKEN_PATH,
    message: { message: 'Слишком много запросов, попробуйте позже' },
})

const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
    if (!RATE_LIMIT.enabled) {
        next()
        return
    }
    csrfTokenLimiter(req, res, (err?: unknown) => {
        if (err) {
            next(err)
            return
        }
        apiLimiter(req, res, next)
    })
}

export default rateLimiter

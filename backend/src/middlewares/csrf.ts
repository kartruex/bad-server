import { doubleCsrf } from 'csrf-csrf'
import { Request } from 'express'
import { CSRF } from '../config'

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
    getSecret: () => CSRF.secret,
    getSessionIdentifier: (req: Request) => req.ip ?? '',
    cookieName: CSRF.cookieName,
    cookieOptions: CSRF.cookieOptions,
    size: 32,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getCsrfTokenFromRequest: (req: Request) => req.headers['x-csrf-token'],
})

export { doubleCsrfProtection, generateCsrfToken }

import { CookieOptions } from 'express'
import ms from 'ms'

export const { PORT = '3000' } = process.env
export const { DB_ADDRESS = 'mongodb://127.0.0.1:27017/weblarek' } = process.env
export const { ORIGIN_ALLOW = 'http://localhost:5173' } = process.env

export const ACCESS_TOKEN = {
    secret: process.env.AUTH_ACCESS_TOKEN_SECRET || 'secret-dev',
    expiry: process.env.AUTH_ACCESS_TOKEN_EXPIRY || '10m',
}

export const REFRESH_TOKEN = {
    secret: process.env.AUTH_REFRESH_TOKEN_SECRET || 'secret-dev',
    expiry: process.env.AUTH_REFRESH_TOKEN_EXPIRY || '7d',
    cookie: {
        name: 'refreshToken',
        options: {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: ms(process.env.AUTH_REFRESH_TOKEN_EXPIRY || '7d'),
            path: '/',
        } as CookieOptions,
    },
}

export const CSRF = {
    secret: process.env.CSRF_TOKEN_SECRET || 'csrf-secret-dev',
    cookieName: '_csrf',
    headerName: 'x-csrf-token',
    cookieOptions: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
    } as CookieOptions,
}

export const RATE_LIMIT = {
    enabled: process.env.RATE_LIMITED !== 'false',
    points: Number(process.env.RATE_LIMIT_POINTS) || 40,
    durationSec: Number(process.env.RATE_LIMIT_DURATION) || 60,
}

// Пагинация: жёсткий верхний предел, чтобы один запрос не выгружал всю коллекцию
export const PAGINATION = {
    maxLimit: 10,
    defaultLimit: 10,
    maxPage: 10000,
}

export const UPLOAD = {
    path: process.env.UPLOAD_PATH || 'images',
    tempPath: process.env.UPLOAD_PATH_TEMP || 'temp',
    minFileSize: Number(process.env.UPLOAD_MIN_FILE_SIZE) || 2 * 1024,
    maxFileSize: Number(process.env.UPLOAD_MAX_FILE_SIZE) || 10 * 1024 * 1024,
}

export const BODY_LIMIT = process.env.BODY_LIMIT || '100kb'

// Предельные длины пользовательских строк — защита от переполнения буферов
export const MAX_LENGTH = {
    name: 30,
    email: 254,
    password: 72,
    phone: 20,
    address: 200,
    comment: 1024,
    search: 100,
    title: 30,
    description: 1000,
    category: 30,
    fileName: 255,
    orderItems: 100,
}

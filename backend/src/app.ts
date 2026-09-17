import { errors } from 'celebrate'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import express, { json, urlencoded } from 'express'
import helmet from 'helmet'
import mongoose from 'mongoose'
import path from 'path'
import { BODY_LIMIT, DB_ADDRESS, ORIGIN_ALLOW, PORT } from './config'
import errorHandler from './middlewares/error-handler'
import rateLimiter from './middlewares/rate-limiter'
import serveStatic from './middlewares/serverStatic'
import routes from './routes'

const app = express()

// За nginx: доверяем одному прокси, иначе rate limiter видит один и тот же IP
app.set('trust proxy', 1)
app.disable('x-powered-by')

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: ORIGIN_ALLOW, credentials: true }))
app.use(cookieParser())

// Статика отдаётся до лимитера: картинки товаров кешируются и не расходуют лимит
app.use(serveStatic(path.join(__dirname, 'public')))

app.use(rateLimiter)
app.use(urlencoded({ extended: false, limit: BODY_LIMIT }))
app.use(json({ limit: BODY_LIMIT }))

app.use(routes)
app.use(errors())
app.use(errorHandler)

const RECONNECT_DELAY_MS = 3000

// База может быть ещё не поднята: процесс ждёт её, а не падает
const connectToDatabase = async (): Promise<void> => {
    try {
        await mongoose.connect(DB_ADDRESS)
    } catch {
        await new Promise((resolve) => {
            setTimeout(resolve, RECONNECT_DELAY_MS)
        })
        await connectToDatabase()
    }
}

const bootstrap = async () => {
    await connectToDatabase()
    app.listen(PORT)
}

bootstrap()

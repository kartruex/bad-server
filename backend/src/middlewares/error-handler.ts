import { ErrorRequestHandler } from 'express'
import { MulterError } from 'multer'

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof MulterError) {
        res.status(400).send({ message: 'Некорректный файл' })
        return
    }

    const statusCode = Number(err?.statusCode || err?.status) || 500

    if (statusCode >= 500) {
        // Только серверные ошибки попадают в лог, иначе поток 4xx забьёт диск
        console.error(err instanceof Error ? err.stack : err)
    }

    // Наружу уходит только заранее заданный текст: сообщения драйвера БД
    // и стектрейсы раскрывают версии и структуру приложения
    const message =
        statusCode >= 500 ? 'На сервере произошла ошибка' : String(err.message)

    res.status(statusCode).send({ message })
}

export default errorHandler

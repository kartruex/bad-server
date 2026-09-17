import { randomUUID } from 'crypto'
import { Express, Request } from 'express'
import { mkdirSync } from 'fs'
import multer, { FileFilterCallback } from 'multer'
import { extname, join } from 'path'
import { UPLOAD } from '../config'

type DestinationCallback = (error: Error | null, destination: string) => void
type FileNameCallback = (error: Error | null, filename: string) => void

// Расширение берём из таблицы разрешённых типов, а не из имени файла пользователя
const ALLOWED_TYPES: Record<string, string> = {
    'image/png': '.png',
    'image/jpg': '.jpg',
    'image/jpeg': '.jpeg',
    'image/gif': '.gif',
}

export const ALLOWED_IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'gif']

const uploadDir = join(__dirname, `../public/${UPLOAD.tempPath}`)

const storage = multer.diskStorage({
    destination: (
        _req: Request,
        _file: Express.Multer.File,
        cb: DestinationCallback
    ) => {
        mkdirSync(uploadDir, { recursive: true })
        cb(null, uploadDir)
    },

    filename: (
        _req: Request,
        file: Express.Multer.File,
        cb: FileNameCallback
    ) => {
        const ext =
            ALLOWED_TYPES[file.mimetype] ??
            extname(file.originalname).toLowerCase()
        cb(null, `${randomUUID()}${ext}`)
    },
})

const fileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
) => cb(null, file.mimetype in ALLOWED_TYPES)

export default multer({
    storage,
    fileFilter,
    limits: {
        fileSize: UPLOAD.maxFileSize,
        files: 1,
        fields: 10,
        fieldNameSize: 100,
        fieldSize: 1024,
    },
})

import { NextFunction, Request, Response } from 'express'
import { unlink } from 'fs/promises'
import { constants } from 'http2'
import sharp from 'sharp'
import { UPLOAD } from '../config'
import BadRequestError from '../errors/bad-request-error'
import { ALLOWED_IMAGE_FORMATS } from '../middlewares/file'

const removeFile = async (filePath: string) => {
    await unlink(filePath).catch(() => undefined)
}

export const uploadFile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.file) {
        return next(new BadRequestError('Файл не загружен'))
    }

    const { file } = req

    try {
        if (file.size < UPLOAD.minFileSize) {
            await removeFile(file.path)
            return next(
                new BadRequestError(
                    `Файл меньше допустимого размера (${UPLOAD.minFileSize} байт)`
                )
            )
        }

        // Расширение и MIME-тип подделываются, поэтому проверяем содержимое файла
        const metadata = await sharp(file.path).metadata()
        if (
            !metadata.format ||
            !ALLOWED_IMAGE_FORMATS.includes(metadata.format) ||
            !metadata.width ||
            !metadata.height
        ) {
            await removeFile(file.path)
            return next(new BadRequestError('Загруженный файл не изображение'))
        }

        return res.status(constants.HTTP_STATUS_CREATED).send({
            fileName: `/${UPLOAD.path}/${file.filename}`,
            originalName: file.originalname,
        })
    } catch {
        await removeFile(file.path)
        return next(new BadRequestError('Загруженный файл не изображение'))
    }
}

export default uploadFile

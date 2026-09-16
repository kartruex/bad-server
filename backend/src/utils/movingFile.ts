import { existsSync, mkdirSync, renameSync } from 'fs'
import { basename, join, resolve } from 'path'

function movingFile(imagePath: string, from: string, to: string) {
    // basename отсекает любые './..' в имени, пришедшем от клиента
    const fileName = basename(imagePath)
    const imagePathTemp = resolve(from, fileName)
    const imagePathPermanent = join(to, fileName)

    if (!imagePathTemp.startsWith(resolve(from))) {
        throw new Error('Ошибка при сохранении файла')
    }

    mkdirSync(to, { recursive: true })
    if (!existsSync(imagePathTemp)) {
        throw new Error('Ошибка при сохранении файла')
    }

    // Синхронный вызов: исключение из колбэка fs.rename роняло процесс
    renameSync(imagePathTemp, imagePathPermanent)
}

export default movingFile

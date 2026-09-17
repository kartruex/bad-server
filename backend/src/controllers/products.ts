import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import { Error as MongooseError } from 'mongoose'
import { join } from 'path'
import { PAGINATION, UPLOAD } from '../config'
import BadRequestError from '../errors/bad-request-error'
import ConflictError from '../errors/conflict-error'
import NotFoundError from '../errors/not-found-error'
import Product from '../models/product'
import movingFile from '../utils/movingFile'

// GET /product
const getProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.min(
            Math.max(Math.trunc(Number(req.query.page)) || 1, 1),
            PAGINATION.maxPage
        )
        const limit = Math.min(
            Math.max(
                Math.trunc(Number(req.query.limit)) || PAGINATION.defaultLimit,
                1
            ),
            PAGINATION.maxLimit
        )
        const products = await Product.find({}, null, {
            skip: (page - 1) * limit,
            limit,
        })
        const totalProducts = await Product.countDocuments({})
        // Каталог одинаков для всех, поэтому его можно отдавать из кеша
        res.set('Cache-Control', 'public, max-age=60')
        return res.send({
            items: products,
            pagination: {
                totalProducts,
                totalPages: Math.ceil(totalProducts / limit),
                currentPage: page,
                pageSize: limit,
            },
        })
    } catch (err) {
        return next(err)
    }
}

// POST /product
const createProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { description, category, price, title, image } = req.body

        // Переносим картинку из временной папки
        if (image) {
            movingFile(
                image.fileName,
                join(__dirname, `../public/${UPLOAD.tempPath}`),
                join(__dirname, `../public/${UPLOAD.path}`)
            )
        }

        const product = await Product.create({
            description,
            image,
            category,
            price,
            title,
        })
        return res.status(constants.HTTP_STATUS_CREATED).send(product)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Товар с таким заголовком уже существует')
            )
        }
        return next(error)
    }
}

// PUT /product
const updateProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { productId } = req.params
        const { image } = req.body

        // Переносим картинку из временной папки
        if (image) {
            movingFile(
                image.fileName,
                join(__dirname, `../public/${UPLOAD.tempPath}`),
                join(__dirname, `../public/${UPLOAD.path}`)
            )
        }

        const product = await Product.findByIdAndUpdate(
            productId,
            {
                $set: {
                    ...req.body,
                    price: req.body.price ? req.body.price : null,
                    image: req.body.image ? req.body.image : undefined,
                },
            },
            { runValidators: true, new: true }
        ).orFail(() => new NotFoundError('Нет товара по заданному id'))
        return res.send(product)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID товара'))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Товар с таким заголовком уже существует')
            )
        }
        return next(error)
    }
}

// DELETE /product
const deleteProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { productId } = req.params
        const product = await Product.findByIdAndDelete(productId).orFail(
            () => new NotFoundError('Нет товара по заданному id')
        )
        return res.send(product)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID товара'))
        }
        return next(error)
    }
}

export { createProduct, deleteProduct, getProducts, updateProduct }

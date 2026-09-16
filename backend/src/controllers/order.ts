import { NextFunction, Request, Response } from 'express'
import {
    FilterQuery,
    Error as MongooseError,
    PipelineStage,
    Types,
} from 'mongoose'
import { PAGINATION } from '../config'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import Order, { IOrder } from '../models/order'
import Product, { IProduct } from '../models/product'
import User from '../models/user'
import escapeRegExp from '../utils/escapeRegExp'

// Пользователь не должен влиять на объём выборки: приводим page/limit к числам
// и режем limit верхней границей
const normalizePagination = (query: Request['query']) => {
    const page = Math.min(
        Math.max(Math.trunc(Number(query.page)) || 1, 1),
        PAGINATION.maxPage
    )
    const limit = Math.min(
        Math.max(Math.trunc(Number(query.limit)) || PAGINATION.defaultLimit, 1),
        PAGINATION.maxLimit
    )
    return { page, limit, skip: (page - 1) * limit }
}

// Из документа пользователя наружу уходят только витринные поля:
// $lookup иначе отдал бы хеш пароля и refresh-токены
const CUSTOMER_PROJECTION = {
    _id: '$customer._id',
    name: '$customer.name',
    email: '$customer.email',
    phone: '$customer.phone',
    totalAmount: '$customer.totalAmount',
    orderCount: '$customer.orderCount',
}

export const getOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            sortField = 'createdAt',
            sortOrder = 'desc',
            status,
            totalAmountFrom,
            totalAmountTo,
            orderDateFrom,
            orderDateTo,
            search,
        } = req.query
        const { page, limit, skip } = normalizePagination(req.query)

        const filters: FilterQuery<Partial<IOrder>> = {}

        if (status) {
            filters.status = String(status)
        }

        if (totalAmountFrom) {
            filters.totalAmount = {
                ...filters.totalAmount,
                $gte: Number(totalAmountFrom),
            }
        }

        if (totalAmountTo) {
            filters.totalAmount = {
                ...filters.totalAmount,
                $lte: Number(totalAmountTo),
            }
        }

        if (orderDateFrom) {
            filters.createdAt = {
                ...filters.createdAt,
                $gte: new Date(orderDateFrom as string),
            }
        }

        if (orderDateTo) {
            filters.createdAt = {
                ...filters.createdAt,
                $lte: new Date(orderDateTo as string),
            }
        }

        const pipeline: PipelineStage[] = [
            { $match: filters },
            {
                $lookup: {
                    from: 'products',
                    localField: 'products',
                    foreignField: '_id',
                    as: 'products',
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'customer',
                    foreignField: '_id',
                    as: 'customer',
                },
            },
            { $unwind: '$customer' },
        ]

        if (search) {
            // Спецсимволы экранируются: иначе строка поиска становится
            // регулярным выражением и может подвесить сервер
            const searchRegex = new RegExp(escapeRegExp(String(search)), 'i')
            const searchNumber = Number(search)
            const searchConditions: FilterQuery<unknown>[] = [
                { 'products.title': searchRegex },
            ]

            if (!Number.isNaN(searchNumber)) {
                searchConditions.push({ orderNumber: searchNumber })
            }

            pipeline.push({ $match: { $or: searchConditions } })
        }

        pipeline.push(
            {
                $project: {
                    orderNumber: 1,
                    status: 1,
                    totalAmount: 1,
                    products: 1,
                    createdAt: 1,
                    deliveryAddress: 1,
                    payment: 1,
                    email: 1,
                    phone: 1,
                    comment: 1,
                    customer: CUSTOMER_PROJECTION,
                },
            },
            { $sort: { [String(sortField)]: sortOrder === 'desc' ? -1 : 1 } },
            {
                $facet: {
                    orders: [{ $skip: skip }, { $limit: limit }],
                    total: [{ $count: 'count' }],
                },
            }
        )

        const [result] = await Order.aggregate(pipeline)
        const orders = result?.orders ?? []
        const totalOrders = result?.total?.[0]?.count ?? 0

        return res.status(200).json({
            orders,
            pagination: {
                totalOrders,
                totalPages: Math.ceil(totalOrders / limit),
                currentPage: page,
                pageSize: limit,
            },
        })
    } catch (error) {
        return next(error)
    }
}

export const getOrdersCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = res.locals.user._id
        const { search } = req.query
        const { page, limit, skip } = normalizePagination(req.query)

        const user = await User.findById(userId)
            .populate({
                path: 'orders',
                populate: [{ path: 'products' }, { path: 'customer' }],
            })
            .orFail(
                () =>
                    new NotFoundError(
                        'Пользователь по заданному id отсутствует в базе'
                    )
            )

        let orders = user.orders as unknown as IOrder[]

        if (search) {
            const searchRegex = new RegExp(escapeRegExp(String(search)), 'i')
            const searchNumber = Number(search)
            const products = await Product.find({ title: searchRegex }, '_id')
            const productIds = products.map((product) => product._id)

            orders = orders.filter((order) => {
                const matchesProductTitle = order.products.some((product) =>
                    productIds.some((id) => id.equals(product._id))
                )
                const matchesOrderNumber =
                    !Number.isNaN(searchNumber) &&
                    order.orderNumber === searchNumber

                return matchesOrderNumber || matchesProductTitle
            })
        }

        const totalOrders = orders.length

        return res.send({
            orders: orders.slice(skip, skip + limit),
            pagination: {
                totalOrders,
                totalPages: Math.ceil(totalOrders / limit),
                currentPage: page,
                pageSize: limit,
            },
        })
    } catch (error) {
        return next(error)
    }
}

export const getOrderByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const order = await Order.findOne({
            orderNumber: Number(req.params.orderNumber),
        })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

export const getOrderCurrentUserByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user._id
    try {
        const order = await Order.findOne({
            orderNumber: Number(req.params.orderNumber),
        })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
        if (!order.customer._id.equals(userId)) {
            // Если нет доступа не возвращаем 403, а отдаем 404
            return next(
                new NotFoundError('Заказ по заданному id отсутствует в базе')
            )
        }
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

// POST /order
export const createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = res.locals.user._id
        const { address, payment, phone, total, email, items, comment } =
            req.body

        const products = await Product.find<IProduct>({
            _id: {
                $in: (items as string[]).map((id) => new Types.ObjectId(id)),
            },
        })

        const basket = (items as string[]).map((id) => {
            const product = products.find((p) => p._id.equals(id))
            if (!product) {
                throw new BadRequestError(`Товар с id ${id} не найден`)
            }
            if (product.price === null) {
                throw new BadRequestError(`Товар с id ${id} не продается`)
            }
            return product
        })

        const totalBasket = basket.reduce((a, c) => a + c.price, 0)
        if (totalBasket !== total) {
            return next(new BadRequestError('Неверная сумма заказа'))
        }

        const newOrder = new Order({
            totalAmount: total,
            products: items,
            payment,
            phone,
            email,
            comment,
            customer: userId,
            deliveryAddress: address,
        })
        const populateOrder = await newOrder.populate(['customer', 'products'])
        await populateOrder.save()

        return res.status(200).json(populateOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        return next(error)
    }
}

export const updateOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { status } = req.body
        const updatedOrder = await Order.findOneAndUpdate(
            { orderNumber: Number(req.params.orderNumber) },
            { status },
            { new: true, runValidators: true }
        )
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])
        return res.status(200).json(updatedOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

export const deleteOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const deletedOrder = await Order.findByIdAndDelete(req.params.id)
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])
        return res.status(200).json(deletedOrder)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

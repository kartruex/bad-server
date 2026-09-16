import { NextFunction, Request, Response } from 'express'
import { FilterQuery } from 'mongoose'
import { PAGINATION } from '../config'
import NotFoundError from '../errors/not-found-error'
import Order from '../models/order'
import User, { IUser } from '../models/user'
import escapeRegExp from '../utils/escapeRegExp'

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

const endOfDay = (value: unknown) => {
    const date = new Date(String(value))
    date.setHours(23, 59, 59, 999)
    return date
}

export const getCustomers = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            sortField = 'createdAt',
            sortOrder = 'desc',
            registrationDateFrom,
            registrationDateTo,
            lastOrderDateFrom,
            lastOrderDateTo,
            totalAmountFrom,
            totalAmountTo,
            orderCountFrom,
            orderCountTo,
            search,
        } = req.query
        const { page, limit, skip } = normalizePagination(req.query)

        const filters: FilterQuery<Partial<IUser>> = {}

        if (registrationDateFrom) {
            filters.createdAt = {
                ...filters.createdAt,
                $gte: new Date(String(registrationDateFrom)),
            }
        }

        if (registrationDateTo) {
            filters.createdAt = {
                ...filters.createdAt,
                $lte: endOfDay(registrationDateTo),
            }
        }

        if (lastOrderDateFrom) {
            filters.lastOrderDate = {
                ...filters.lastOrderDate,
                $gte: new Date(String(lastOrderDateFrom)),
            }
        }

        if (lastOrderDateTo) {
            filters.lastOrderDate = {
                ...filters.lastOrderDate,
                $lte: endOfDay(lastOrderDateTo),
            }
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

        if (orderCountFrom) {
            filters.orderCount = {
                ...filters.orderCount,
                $gte: Number(orderCountFrom),
            }
        }

        if (orderCountTo) {
            filters.orderCount = {
                ...filters.orderCount,
                $lte: Number(orderCountTo),
            }
        }

        if (search) {
            // Строка поиска экранируется, иначе она интерпретируется
            // как регулярное выражение и роняет запрос или вешает сервер
            const searchRegex = new RegExp(escapeRegExp(String(search)), 'i')
            const orders = await Order.find(
                { deliveryAddress: searchRegex },
                '_id'
            )

            filters.$or = [
                { name: searchRegex },
                { lastOrder: { $in: orders.map((order) => order._id) } },
            ]
        }

        const options = {
            sort: { [String(sortField)]: sortOrder === 'desc' ? -1 : 1 },
            skip,
            limit,
        }

        const users = await User.find(filters, null, options).populate([
            'orders',
            {
                path: 'lastOrder',
                populate: { path: 'products' },
            },
        ])

        const totalUsers = await User.countDocuments(filters)

        return res.status(200).json({
            customers: users,
            pagination: {
                totalUsers,
                totalPages: Math.ceil(totalUsers / limit),
                currentPage: page,
                pageSize: limit,
            },
        })
    } catch (error) {
        return next(error)
    }
}

export const getCustomerById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const user = await User.findById(req.params.id)
            .populate(['orders', 'lastOrder'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Пользователь по заданному id отсутствует в базе'
                    )
            )
        return res.status(200).json(user)
    } catch (error) {
        return next(error)
    }
}

export const updateCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Поля пришли из белого списка валидатора: роли и токены изменить нельзя
        const { name, email, phone } = req.body
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    ...(name && { name }),
                    ...(email && { email }),
                    ...(phone && { phone }),
                },
            },
            { new: true, runValidators: true }
        )
            .orFail(
                () =>
                    new NotFoundError(
                        'Пользователь по заданному id отсутствует в базе'
                    )
            )
            .populate(['orders', 'lastOrder'])
        return res.status(200).json(updatedUser)
    } catch (error) {
        return next(error)
    }
}

export const deleteCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id).orFail(
            () =>
                new NotFoundError(
                    'Пользователь по заданному id отсутствует в базе'
                )
        )
        return res.status(200).json(deletedUser)
    } catch (error) {
        return next(error)
    }
}

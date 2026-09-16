import { Router } from 'express'
import {
    createOrder,
    deleteOrder,
    getOrderByNumber,
    getOrderCurrentUserByNumber,
    getOrders,
    getOrdersCurrentUser,
    updateOrder,
} from '../controllers/order'
import { roleGuardMiddleware } from '../middlewares/auth'
import {
    validateOrderBody,
    validateOrderId,
    validateOrderNumber,
    validateOrderStatusBody,
    validateOrdersQuery,
} from '../middlewares/validations'
import { Role } from '../models/user'

const orderRouter = Router()

orderRouter.post('/', validateOrderBody, createOrder)
orderRouter.get('/all/me', validateOrdersQuery, getOrdersCurrentUser)
orderRouter.get(
    '/me/:orderNumber',
    validateOrderNumber,
    getOrderCurrentUserByNumber
)

orderRouter.get(
    '/all',
    roleGuardMiddleware(Role.Admin),
    validateOrdersQuery,
    getOrders
)
orderRouter.get(
    '/:orderNumber',
    roleGuardMiddleware(Role.Admin),
    validateOrderNumber,
    getOrderByNumber
)
orderRouter.patch(
    '/:orderNumber',
    roleGuardMiddleware(Role.Admin),
    validateOrderNumber,
    validateOrderStatusBody,
    updateOrder
)
orderRouter.delete(
    '/:id',
    roleGuardMiddleware(Role.Admin),
    validateOrderId,
    deleteOrder
)

export default orderRouter

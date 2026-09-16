import { Router } from 'express'
import {
    deleteCustomer,
    getCustomerById,
    getCustomers,
    updateCustomer,
} from '../controllers/customers'
import { roleGuardMiddleware } from '../middlewares/auth'
import {
    validateCustomersQuery,
    validateUserId,
    validateUserUpdateBody,
} from '../middlewares/validations'
import { Role } from '../models/user'

const customerRouter = Router()

// Клиентская база доступна только администратору
customerRouter.use(roleGuardMiddleware(Role.Admin))

customerRouter.get('/', validateCustomersQuery, getCustomers)
customerRouter.get('/:id', validateUserId, getCustomerById)
customerRouter.patch(
    '/:id',
    validateUserId,
    validateUserUpdateBody,
    updateCustomer
)
customerRouter.delete('/:id', validateUserId, deleteCustomer)

export default customerRouter

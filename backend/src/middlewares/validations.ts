import { Joi, celebrate } from 'celebrate'
import { Types } from 'mongoose'
import { MAX_LENGTH, PAGINATION } from '../config'
import sanitizeText from '../utils/sanitize'

// Линейная проверка без вложенных квантификаторов и с жёсткой длиной:
// прежний вариант /^(\+\d+)?(?:\s|-?|\(?\d+\)?)+$/ давал экспоненциальный откат
export const phoneRegExp = /^\+?[0-9][0-9\s\-()]{5,18}$/

export const FILE_NAME_REGEXP = /^[\w./-]{1,255}$/

export enum PaymentType {
    Card = 'card',
    Online = 'online',
}

// Дублируем значения StatusType, чтобы не замкнуть импорты с моделью заказа
export const ORDER_STATUSES = ['new', 'delivering', 'completed', 'cancelled']

const objectId = Joi.string().custom((value, helpers) => {
    if (Types.ObjectId.isValid(value)) {
        return value
    }
    return helpers.message({ custom: 'Невалидный id' })
})

const sanitizedString = (max: number) =>
    Joi.string()
        .max(max)
        .custom((value: string) => sanitizeText(value))

// Ограничения пагинации задаются до обращения к базе,
// иначе один запрос выгружает всю коллекцию
const paginationKeys = {
    page: Joi.number().integer().min(1).max(PAGINATION.maxPage),
    limit: Joi.number().integer().min(1),
    sortOrder: Joi.string().valid('asc', 'desc'),
}

export const validateOrderBody = celebrate({
    body: Joi.object().keys({
        items: Joi.array()
            .items(objectId)
            .min(1)
            .max(MAX_LENGTH.orderItems)
            .required()
            .messages({
                'array.empty': 'Не указаны товары',
                'array.max': 'Слишком много товаров в заказе',
            }),
        payment: Joi.string()
            .valid(...Object.values(PaymentType))
            .required()
            .messages({
                'any.only':
                    'Указано не валидное значение для способа оплаты, возможные значения - "card", "online"',
                'string.empty': 'Не указан способ оплаты',
            }),
        email: Joi.string().max(MAX_LENGTH.email).email().required().messages({
            'string.empty': 'Не указан email',
        }),
        phone: Joi.string()
            .max(MAX_LENGTH.phone)
            .pattern(phoneRegExp)
            .required()
            .messages({
                'string.empty': 'Не указан телефон',
                'string.pattern.base': 'Не валидный номер телефона',
            }),
        address: sanitizedString(MAX_LENGTH.address).required().messages({
            'string.empty': 'Не указан адрес',
        }),
        total: Joi.number().min(0).max(Number.MAX_SAFE_INTEGER).required(),
        comment: sanitizedString(MAX_LENGTH.comment).allow(''),
    }),
})

export const validateOrderStatusBody = celebrate({
    body: Joi.object().keys({
        status: Joi.string()
            .valid(...ORDER_STATUSES)
            .required(),
    }),
})

export const validateOrdersQuery = celebrate({
    query: Joi.object().keys({
        ...paginationKeys,
        sortField: Joi.string().valid(
            'createdAt',
            'totalAmount',
            'orderNumber',
            'status'
        ),
        // Только строка из белого списка: объект в query позволял подмешать
        // операторы MongoDB вроде $expr/$function прямо в $match
        status: Joi.string()
            .valid(...ORDER_STATUSES)
            .allow(''),
        totalAmountFrom: Joi.number().min(0),
        totalAmountTo: Joi.number().min(0),
        orderDateFrom: Joi.date().iso(),
        orderDateTo: Joi.date().iso(),
        search: Joi.string().max(MAX_LENGTH.search).allow(''),
    }),
})

export const validateCustomersQuery = celebrate({
    query: Joi.object().keys({
        ...paginationKeys,
        sortField: Joi.string().valid(
            'createdAt',
            'totalAmount',
            'orderCount',
            'lastOrderDate',
            'name'
        ),
        registrationDateFrom: Joi.date().iso(),
        registrationDateTo: Joi.date().iso(),
        lastOrderDateFrom: Joi.date().iso(),
        lastOrderDateTo: Joi.date().iso(),
        totalAmountFrom: Joi.number().min(0),
        totalAmountTo: Joi.number().min(0),
        orderCountFrom: Joi.number().integer().min(0),
        orderCountTo: Joi.number().integer().min(0),
        search: Joi.string().max(MAX_LENGTH.search).allow(''),
    }),
})

export const validateProductsQuery = celebrate({
    query: Joi.object().keys(paginationKeys),
})

export const validateOrderNumber = celebrate({
    params: Joi.object().keys({
        orderNumber: Joi.number().integer().min(1).required(),
    }),
})

const imageSchema = Joi.object().keys({
    fileName: Joi.string()
        .max(MAX_LENGTH.fileName)
        .pattern(FILE_NAME_REGEXP)
        .required(),
    originalName: sanitizedString(MAX_LENGTH.fileName).required(),
})

export const validateProductBody = celebrate({
    body: Joi.object().keys({
        title: sanitizedString(MAX_LENGTH.title).min(2).required().messages({
            'string.min': 'Минимальная длина поля "title" - 2',
            'string.max': 'Максимальная длина поля "title" - 30',
            'string.empty': 'Поле "title" должно быть заполнено',
        }),
        image: imageSchema,
        category: sanitizedString(MAX_LENGTH.category).required().messages({
            'string.empty': 'Поле "category" должно быть заполнено',
        }),
        description: sanitizedString(MAX_LENGTH.description)
            .required()
            .messages({
                'string.empty': 'Поле "description" должно быть заполнено',
            }),
        price: Joi.number().min(0).allow(null),
    }),
})

export const validateProductUpdateBody = celebrate({
    body: Joi.object()
        .keys({
            title: sanitizedString(MAX_LENGTH.title).min(2),
            image: imageSchema,
            category: sanitizedString(MAX_LENGTH.category),
            description: sanitizedString(MAX_LENGTH.description),
            price: Joi.number().min(0).allow(null),
        })
        .min(1),
})

export const validateObjId = celebrate({
    params: Joi.object().keys({
        productId: objectId.required(),
    }),
})

export const validateUserId = celebrate({
    params: Joi.object().keys({
        id: objectId.required(),
    }),
})

export const validateOrderId = celebrate({
    params: Joi.object().keys({
        id: objectId.required(),
    }),
})

export const validateUserBody = celebrate({
    body: Joi.object().keys({
        name: sanitizedString(MAX_LENGTH.name).min(2).messages({
            'string.min': 'Минимальная длина поля "name" - 2',
            'string.max': 'Максимальная длина поля "name" - 30',
        }),
        password: Joi.string()
            .min(6)
            .max(MAX_LENGTH.password)
            .required()
            .messages({
                'string.empty': 'Поле "password" должно быть заполнено',
            }),
        email: Joi.string()
            .max(MAX_LENGTH.email)
            .required()
            .email()
            .message('Поле "email" должно быть валидным email-адресом'),
    }),
})

// Белый список полей: раньше тело запроса уходило в апдейт целиком,
// что позволяло выставить себе roles: ["admin"]
export const validateUserUpdateBody = celebrate({
    body: Joi.object()
        .keys({
            name: sanitizedString(MAX_LENGTH.name).min(2),
            email: Joi.string()
                .max(MAX_LENGTH.email)
                .email()
                .message('Поле "email" должно быть валидным email-адресом'),
            phone: Joi.string().max(MAX_LENGTH.phone).pattern(phoneRegExp),
        })
        .min(1),
})

export const validateAuthentication = celebrate({
    body: Joi.object().keys({
        email: Joi.string()
            .max(MAX_LENGTH.email)
            .required()
            .email()
            .message('Поле "email" должно быть валидным email-адресом'),
        password: Joi.string().max(MAX_LENGTH.password).required().messages({
            'string.empty': 'Поле "password" должно быть заполнено',
        }),
    }),
})

import crypto from 'crypto'
import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { Error as MongooseError, Types } from 'mongoose'
import { REFRESH_TOKEN } from '../config'
import BadRequestError from '../errors/bad-request-error'
import ConflictError from '../errors/conflict-error'
import NotFoundError from '../errors/not-found-error'
import UnauthorizedError from '../errors/unauthorized-error'
import { generateCsrfToken } from '../middlewares/csrf'
import User from '../models/user'

// GET /auth/csrf-token
const getCsrfToken = (req: Request, res: Response) =>
    res.json({ csrfToken: generateCsrfToken(req, res) })

// POST /auth/login
const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body
        const user = await User.findUserByCredentials(email, password)
        const accessToken = user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()
        res.cookie(
            REFRESH_TOKEN.cookie.name,
            refreshToken,
            REFRESH_TOKEN.cookie.options
        )
        return res.json({
            success: true,
            user,
            accessToken,
        })
    } catch (err) {
        return next(err)
    }
}

// POST /auth/register
const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password, name } = req.body
        // Роли не берём из тела запроса: новый аккаунт всегда обычный покупатель
        const newUser = new User({ email, password, name })
        await newUser.save()
        const accessToken = newUser.generateAccessToken()
        const refreshToken = await newUser.generateRefreshToken()

        res.cookie(
            REFRESH_TOKEN.cookie.name,
            refreshToken,
            REFRESH_TOKEN.cookie.options
        )
        return res.status(constants.HTTP_STATUS_CREATED).json({
            success: true,
            user: newUser,
            accessToken,
        })
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Пользователь с таким email уже существует')
            )
        }
        return next(error)
    }
}

// GET /auth/user
const getCurrentUser = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const user = await User.findById(res.locals.user._id).orFail(
            () =>
                new NotFoundError(
                    'Пользователь по заданному id отсутствует в базе'
                )
        )
        return res.json({ user, success: true })
    } catch (error) {
        return next(error)
    }
}

const deleteRefreshTokenInUser = async (req: Request) => {
    const rfTkn = req.cookies[REFRESH_TOKEN.cookie.name]

    if (!rfTkn || typeof rfTkn !== 'string') {
        throw new UnauthorizedError('Не валидный токен')
    }

    let decodedRefreshTkn: JwtPayload
    try {
        decodedRefreshTkn = jwt.verify(
            rfTkn,
            REFRESH_TOKEN.secret
        ) as JwtPayload
    } catch {
        throw new UnauthorizedError('Не валидный токен')
    }

    // Идентификатор из токена приводится к ObjectId, а не уходит в запрос как есть
    if (!Types.ObjectId.isValid(String(decodedRefreshTkn._id))) {
        throw new UnauthorizedError('Не валидный токен')
    }

    const user = await User.findOne({
        _id: new Types.ObjectId(String(decodedRefreshTkn._id)),
    }).orFail(() => new UnauthorizedError('Пользователь не найден в базе'))

    const rTknHash = crypto
        .createHmac('sha256', REFRESH_TOKEN.secret)
        .update(rfTkn)
        .digest('hex')

    if (!user.tokens.some((tokenObj) => tokenObj.token === rTknHash)) {
        throw new UnauthorizedError('Не валидный токен')
    }

    user.tokens = user.tokens.filter((tokenObj) => tokenObj.token !== rTknHash)
    await user.save()

    return user
}

// GET /auth/logout
const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await deleteRefreshTokenInUser(req)
        res.cookie(REFRESH_TOKEN.cookie.name, '', {
            ...REFRESH_TOKEN.cookie.options,
            maxAge: -1,
        })
        return res.status(200).json({ success: true })
    } catch (error) {
        return next(error)
    }
}

// GET /auth/token
const refreshAccessToken = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userWithRefreshTkn = await deleteRefreshTokenInUser(req)
        const accessToken = userWithRefreshTkn.generateAccessToken()
        const refreshToken = await userWithRefreshTkn.generateRefreshToken()
        res.cookie(
            REFRESH_TOKEN.cookie.name,
            refreshToken,
            REFRESH_TOKEN.cookie.options
        )
        return res.json({
            success: true,
            user: userWithRefreshTkn,
            accessToken,
        })
    } catch (error) {
        return next(error)
    }
}

// GET /auth/user/roles
const getCurrentUserRoles = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        return res.status(200).json(res.locals.user.roles)
    } catch (error) {
        return next(error)
    }
}

// PATCH /auth/me
const updateCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Обновляем только разрешённые поля: тело запроса целиком позволяло
        // переписать roles, tokens и password
        const { name, email, phone } = req.body
        const updatedUser = await User.findByIdAndUpdate(
            res.locals.user._id,
            {
                $set: {
                    ...(name && { name }),
                    ...(email && { email }),
                    ...(phone && { phone }),
                },
            },
            { new: true, runValidators: true }
        ).orFail(
            () =>
                new NotFoundError(
                    'Пользователь по заданному id отсутствует в базе'
                )
        )
        return res.status(200).json(updatedUser)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Пользователь с таким email уже существует')
            )
        }
        return next(error)
    }
}

export {
    getCsrfToken,
    getCurrentUser,
    getCurrentUserRoles,
    login,
    logout,
    refreshAccessToken,
    register,
    updateCurrentUser,
}

import clsx from 'clsx'
import {
    DetailedHTMLProps,
    FormHTMLAttributes,
    ReactNode,
    SyntheticEvent,
} from 'react'
import styles from './form.module.scss'

interface FormProps
    extends DetailedHTMLProps<
        FormHTMLAttributes<HTMLFormElement>,
        HTMLFormElement
    > {
    handleFormSubmit?: (e: SyntheticEvent<HTMLFormElement>) => void
    children: ReactNode
    extraClass?: string
    formRef?: React.RefObject<HTMLFormElement>
}

export default function Form({
    handleFormSubmit,
    children,
    extraClass,
    formRef,
    ...props
}: FormProps) {
    // Отправку формы всегда обрабатывает приложение: нативный submit
    // перезагружает страницу и теряет состояние роутера
    const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault()
        handleFormSubmit?.(event)
    }

    return (
        <form
            ref={formRef}
            className={clsx(styles.form, {
                [extraClass as string]: !!extraClass,
            })}
            onSubmit={onSubmit}
            {...props}
        >
            {children}
        </form>
    )
}

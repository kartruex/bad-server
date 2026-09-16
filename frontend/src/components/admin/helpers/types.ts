import { IProduct } from '../../../utils/types'

export interface ProductFormValues
    extends Pick<IProduct, 'title' | 'description' | 'price'> {}

// Значение фильтра: либо простое поле ввода, либо выбранный пункт селекта
export type FilterValue = string | number | { value: string } | undefined

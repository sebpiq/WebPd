/*
 * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd_pd-parser for documentation
 *
 */

export const assertNumber = (value: any) => {
    if (typeof value !== 'number') {
        throw new ValidationError(`${value} is not a number`)
    }
    return value
}

export const assertString = (value: any) => {
    if (typeof value !== 'string') {
        throw new ValidationError(`${value} is not a string`)
    }
    return value
}

export const assertOptionalNumber = (value: any): number | undefined => {
    return value !== undefined ? assertNumber(value) : undefined
}

export const assertOptionalString = (value: any): string | undefined => {
    return value !== undefined ? assertString(value) : undefined
}

export class ValidationError extends Error {}

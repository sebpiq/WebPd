/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd 
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
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

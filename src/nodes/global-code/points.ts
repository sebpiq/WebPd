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
import { Class, Func, Var } from '@webpd/compiler/src/ast/declare'
import {
    GlobalCodeGenerator,
    GlobalCodeGeneratorWithSettings,
} from '@webpd/compiler/src/compile/types'

export const point: GlobalCodeGenerator = () => 
    Class('Point', [
        Var('Float', 'x'),
        Var('Float', 'y'),
    ])

export const interpolateLin: GlobalCodeGeneratorWithSettings = {
    codeGenerator: () => 
        Func('interpolateLin', 
            [Var('Float', 'x'), Var('Point', 'p0'), Var('Point', 'p1')],
            'Float'
        )`
            return p0.y + (x - p0.x) * (p1.y - p0.y) / (p1.x - p0.x)
        `,
    dependencies: [point],
}

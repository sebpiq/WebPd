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
import { GlobalCodeGenerator } from "@webpd/compiler/src/compile/types"
import { Func, Var } from "@webpd/compiler"

const MAX_MIDI_FREQ = Math.pow(2, (1499 - 69) / 12) * 440

// Also possible to use optimized version, but gives approximate results : 8.17579891564 * Math.exp(0.0577622650 * value)
export const mtof: GlobalCodeGenerator = () => 
    Func('mtof', [
        Var('Float', 'value'),
    ], 'Float')`
        return value <= -1500 ? 0: (value > 1499 ? ${MAX_MIDI_FREQ} : Math.pow(2, (value - 69) / 12) * 440)
    `

// optimized version of formula : 12 * Math.log(freq / 440) / Math.LN2 + 69
// which is the same as : Math.log(freq / mtof(0)) * (12 / Math.LN2) 
// which is the same as : Math.log(freq / 8.1757989156) * (12 / Math.LN2) 
export const ftom: GlobalCodeGenerator = () => 
    Func('ftom', [
        Var('Float', 'value'),
    ], 'Float')`
        return value <= 0 ? -1500: 12 * Math.log(value / 440) / Math.LN2 + 69
    `

// TODO : tests (see in binop)
export const pow: GlobalCodeGenerator = () => 
    Func('pow', [
        Var('Float', 'leftOp'),
        Var('Float', 'rightOp'),
    ], 'Float')`
        return leftOp > 0 || (Math.round(rightOp) === rightOp) ? Math.pow(leftOp, rightOp): 0
    `
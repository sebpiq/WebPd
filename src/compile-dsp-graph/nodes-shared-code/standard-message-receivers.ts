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

import { CodeVariableName } from '@webpd/compiler-js/src/types'

export const coldFloatInlet = (
    messageName: CodeVariableName,
    storageName: CodeVariableName,
) => {
    return `if (msg_isMatching(${messageName}, [MSG_FLOAT_TOKEN])) {
        ${storageName} = msg_readFloatToken(${messageName}, 0)
        return
    }`
}

export const coldStringInlet = (
    messageName: CodeVariableName,
    storageName: CodeVariableName,
) => {
    return `if (msg_isMatching(${messageName}, [MSG_STRING_TOKEN])) {
        ${storageName} = msg_readStringToken(${messageName}, 0)
        return
    }`
}

export const coldFloatInletWithSetter = (
    messageName: CodeVariableName,
    setterName: CodeVariableName,
) => {
    return `if (msg_isMatching(${messageName}, [MSG_FLOAT_TOKEN])) {
        ${setterName}(msg_readFloatToken(${messageName}, 0))
        return
    }`
}

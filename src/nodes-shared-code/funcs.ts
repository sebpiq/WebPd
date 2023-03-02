import { SharedCodeGenerator } from "@webpd/compiler-js/src/types"

const MAX_MIDI_FREQ = Math.pow(2, (1499 - 69) / 12) * 440

// Also possible to use optimized version, but gives approximate results : 8.17579891564 * Math.exp(0.0577622650 * value)
export const mtof: SharedCodeGenerator = ({ macros: { Func, Var }}) => `
    function mtof ${Func([
        Var('value', 'Float'),
    ], 'Float')} {
        return value <= -1500 ? 0: (value > 1499 ? ${MAX_MIDI_FREQ} : Math.pow(2, (value - 69) / 12) * 440)
    }
`

// optimized version of formula : 12 * Math.log(freq / 440) / Math.LN2 + 69
// which is the same as : Math.log(freq / mtof(0)) * (12 / Math.LN2) 
// which is the same as : Math.log(freq / 8.1757989156) * (12 / Math.LN2) 
export const ftom: SharedCodeGenerator = ({ macros: { Func, Var }}) => `
    function ftom ${Func([
        Var('value', 'Float'),
    ], 'Float')} {
        return value <= 0 ? -1500: 12 * Math.log(value / 440) / Math.LN2 + 69
    }
`
import { SharedCodeGenerator } from "@webpd/compiler-js/src/types"

// TODO : unit testing
// TODO : amount = 0 ?
// TODO : missing persec and all per...
export const computeUnitInSamples: SharedCodeGenerator = ({ macros: { Func, Var } }) => `
    function computeUnitInSamples ${Func([
        Var('sampleRate', 'Float'),
        Var('amount', 'Float'),
        Var('unit', 'string'),
    ], 'Float')} {
        if (unit === 'msec' || unit === 'millisecond') {
            return amount / 1000 * sampleRate
        } else if (unit === 'sec' || unit === 'seconds' || unit === 'second') {
            return amount * sampleRate
        } else if (unit === 'min' || unit === 'minutes' || unit === 'minute') {
            return amount * 60 * sampleRate
        } else if (unit === 'samp' || unit === 'samples' || unit === 'sample') {
            return amount
        } else {
            throw new Error("invalid time unit : " + unit)
        }
    }
`
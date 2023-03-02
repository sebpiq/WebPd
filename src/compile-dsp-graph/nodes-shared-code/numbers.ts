import { SharedCodeGenerator } from "@webpd/compiler-js/src/types"

export const roundFloatAsPdInt: SharedCodeGenerator = ({ macros: { Func, Var }}) => `
    function roundFloatAsPdInt ${Func([
        Var('value', 'Float'),
    ], 'Float')} {
        return value > 0 ? Math.floor(value): Math.ceil(value)
    }
`
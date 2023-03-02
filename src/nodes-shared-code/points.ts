import { SharedCodeGenerator } from "@webpd/compiler-js/src/types";

export const point: SharedCodeGenerator = ({ macros: { Var }}) => `
    class Point {
        ${Var('x', 'Float')}
        ${Var('y', 'Float')}
    }
`

export const interpolateLin: Array<SharedCodeGenerator> = [point, ({ macros: { Var, Func }}) => `
    function interpolateLin ${Func([
        Var('x', 'Float'),
        Var('p0', 'Point'),
        Var('p1', 'Point'),
    ], 'Float')} {
        return p0.y + (x - p0.x) * (p1.y - p0.y) / (p1.x - p0.x)
    }
`]
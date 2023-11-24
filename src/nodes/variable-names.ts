import { DspGraph, functional, createNamespace } from '@webpd/compiler'

export const generateVariableNamesNodeType = <
    Keys extends ReadonlyArray<string>
>(
    nodeType: DspGraph.NodeType,
    functionNames?: Keys
): { [key: string]: string } =>
    createNamespace(nodeType, {
        stateClass: `n_State_${nodeType}`,
        ...functional.mapArray(functionNames || [], (name) => [
            name,
            `n_${nodeType}_${name}`,
        ]),
    })
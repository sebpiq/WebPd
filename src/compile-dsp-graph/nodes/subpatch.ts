import { NodeBuilder } from '../types'

const emptyBuilder: NodeBuilder<{}> = {
    translateArgs: () => ({}),
    build: () => ({
        inlets: {},
        outlets: {},
    }),
}

const nodeBuilders = {
    pd: emptyBuilder,
    inlet: emptyBuilder,
    outlet: emptyBuilder,
    'inlet~': emptyBuilder,
    'outlet~': emptyBuilder,
}

export { nodeBuilders }

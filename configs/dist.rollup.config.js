import { buildRollupConfig } from '@webpd/dev/configs/dist.rollup.mjs'
export default buildRollupConfig({
    importAsString: [
        './src/assets/*',
    ],
    sourcemap: false,
})
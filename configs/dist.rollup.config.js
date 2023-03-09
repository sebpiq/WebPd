import { buildRollupConfig } from '@webpd/dev/configs/rollup.mjs'
export default buildRollupConfig({
    importAsString: [
        './src/app-generator/runtime.generated.js.txt',
    ],
})

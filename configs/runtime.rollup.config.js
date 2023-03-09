import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import { visualizer } from 'rollup-plugin-visualizer'
import commonjs from '@rollup/plugin-commonjs'

// rollup.config.js
export default {
    input: 'main.runtime.ts',
    output: {
        file: 'src/app-generator/runtime.generated.js.txt',
        format: 'iife',
        name: 'WebPdRuntime',
    },
    plugins: [
        typescript({ tsconfig: './configs/runtime.tsconfig.json' }),
        nodeResolve(),
        commonjs(),
        visualizer({
            template: 'network',
            filename: './tmp/runtime-rollup-stats.html',
        }),
        json(),
    ],
}

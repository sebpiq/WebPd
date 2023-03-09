import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import { visualizer } from 'rollup-plugin-visualizer'
import { string } from 'rollup-plugin-string'
import commonjs from '@rollup/plugin-commonjs'

// rollup.config.js
export default {
    input: 'main.cli.ts',
    output: {
        file: 'bin/cli.js',
        format: 'es',
        sourcemap: true,
    },
    plugins: [
        string({
            include: ['./src/app-generator/runtime.generated.js.txt'],
        }),
        typescript(),
        nodeResolve(),
        commonjs(),
        visualizer({
            template: 'network',
            filename: './tmp/bin-rollup-stats.html',
        }),
        json(),
    ],
}

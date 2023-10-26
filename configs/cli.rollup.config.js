import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import { visualizer } from 'rollup-plugin-visualizer'
import { string } from 'rollup-plugin-string'
import commonjs from '@rollup/plugin-commonjs'

export default {
    input: 'main.cli.ts',
    output: {
        file: 'bin/cli.mjs',
        format: 'es',
        banner: '#!/usr/bin/env node',
        sourcemap: true,
    },
    plugins: [
        string({
            include: ['./src/app-generator/runtime.generated.js.txt'],
        }),
        typescript({
            compilerOptions: {
                declaration: false,
            },
        }),
        nodeResolve(),
        commonjs(),
        visualizer({
            template: 'network',
            filename: './tmp/bin-rollup-stats.html',
        }),
        json(),
    ],
}

import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import { visualizer } from 'rollup-plugin-visualizer'
import commonjs from '@rollup/plugin-commonjs'
import path from 'path'
import { CONFIGS_DIR, SRC_DIR, TMP_DIR } from './paths.js'

export default {
    input: path.resolve(SRC_DIR, 'runtime.main.ts'),
    output: {
        file: path.resolve(SRC_DIR, 'assets', 'runtime.js.txt'),
        format: 'iife',
        name: 'WebPdRuntime',
    },
    plugins: [
        typescript({
            tsconfig: path.resolve(CONFIGS_DIR, 'runtime.tsconfig.json'),
        }),
        nodeResolve(),
        commonjs(),
        visualizer({
            template: 'network',
            filename: path.resolve(TMP_DIR, 'runtime.rollup-stats.html'),
        }),
        json(),
    ],
}

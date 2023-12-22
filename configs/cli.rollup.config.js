import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import { visualizer } from 'rollup-plugin-visualizer'
import { string } from 'rollup-plugin-string'
import commonjs from '@rollup/plugin-commonjs'
import path from 'path'
import { CONFIGS_DIR, SRC_DIR, TMP_DIR, BIN_DIR } from './paths.js'

export default {
    input: path.resolve(SRC_DIR, 'cli.main.ts'),
    output: {
        file: path.resolve(BIN_DIR, 'cli.mjs'),
        format: 'es',
        banner: '#!/usr/bin/env node',
        sourcemap: true,
    },
    plugins: [
        string({
            include: ['./src/assets/*'],
        }),
        typescript({
            tsconfig: path.resolve(CONFIGS_DIR, 'cli.tsconfig.json'),
        }),
        nodeResolve(),
        commonjs(),
        visualizer({
            template: 'network',
            filename: path.resolve(TMP_DIR, 'cli.rollup-stats.html'),
        }),
        json(),
    ],
}

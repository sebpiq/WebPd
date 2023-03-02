import typescript from '@rollup/plugin-typescript'
import nodeResolve from '@rollup/plugin-node-resolve'
import { visualizer } from 'rollup-plugin-visualizer'
import commonjs from '@rollup/plugin-commonjs'

// rollup.config.js
export default {
	input: 'src/cli.ts',
	output: {
		file: 'bin/cli.js',
		format: 'es',
		sourcemap: true,
	},
    plugins: [
        typescript(),
        nodeResolve(),
        commonjs(),
		visualizer({
            template: 'network',
            filename: './tmp/bin-rollup-stats.html'
        }),
    ]
};
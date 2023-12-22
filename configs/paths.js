import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)))
import path from 'path'

export const CONFIGS_DIR = __dirname
export const PKG_ROOT = path.resolve(__dirname, '..')
export const SRC_DIR = path.resolve(PKG_ROOT, 'src')
export const BIN_DIR = path.resolve(PKG_ROOT, 'bin')
export const TMP_DIR = path.resolve(PKG_ROOT, 'tmp')
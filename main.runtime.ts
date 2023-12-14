// Beware : import only necessary functions a browser runtime that 
// is as small as possible. Original size is ~50kB, it shouldn't grow much more than that.
export { default as initialize } from './src/browser/initialize'
export { default as run, createDefaultSettings } from './src/browser/run'
export { readMetadata } from '@webpd/compiler'
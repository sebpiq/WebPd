import { registerWebPdWorkletNode } from "@webpd/runtime"

/**
 * Convenience function for initializing WebPd in the browser.
 * Should be ran once (and only once) before running any patches.
 */
export default (...args: Parameters<typeof registerWebPdWorkletNode>) => {
    return registerWebPdWorkletNode(...args)
}
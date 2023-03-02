import { SharedCodeGenerator } from "@webpd/compiler-js/src/types"

// TODO : how to safely declare a global variable without clashing
export const delayBuffers: SharedCodeGenerator = ({ macros: { Var, Func } }) => `
    const ${Var('DELAY_BUFFERS', 'Map<string, buf_SoundBuffer>')} = new Map()
    const ${Var('DELAY_BUFFERS_SKEDULER', 'Skeduler')} = sked_create(true)
    const ${Var('DELAY_BUFFERS_NULL', 'buf_SoundBuffer')} = buf_create(1)

    function DELAY_BUFFERS_set ${Func([
        Var('delayName', 'string'),
        Var('buffer', 'buf_SoundBuffer'),
    ], 'void')} {
        DELAY_BUFFERS.set(delayName, buffer)
        sked_emit(DELAY_BUFFERS_SKEDULER, delayName)
    }

    function DELAY_BUFFERS_get ${Func([
        Var('delayName', 'string'),
        Var('callback', '(event: string) => void'),
    ], 'void')} {
        sked_wait(DELAY_BUFFERS_SKEDULER, delayName, callback)
    }

    function DELAY_BUFFERS_delete ${Func([
        Var('delayName', 'string'),
    ], 'void')} {
        DELAY_BUFFERS.delete(delayName)
    }
`
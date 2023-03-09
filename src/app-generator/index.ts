import { Artefacts } from '../api/types'
import bareBones from './bare-bones'
import WEBPD_RUNTIME_CODE from './runtime.generated.js.txt'
import { GeneratedApp, WEBPD_RUNTIME_FILENAME } from './types'

type Template = 'bare-bones' 

export default (template: Template, artefacts: Artefacts): GeneratedApp => {
    switch(template) {
        case 'bare-bones':
            const generated = bareBones({ artefacts })
            return {
                ...generated,
                [WEBPD_RUNTIME_FILENAME]: WEBPD_RUNTIME_CODE
            }
        default:
            throw new Error(`Unknown template ${template}`)
    }
}
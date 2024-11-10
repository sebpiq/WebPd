import { PdJson } from '@webpd/pd-parser'
import { discoverPdGuiComments } from '../pd-gui/comments'
import { CustomMetadata } from '@webpd/compiler'

interface CommentsMetadata extends CustomMetadata {
    comments: Array<{
        text: string
        position: {
            x: number
            y: number
        }
    }>
}

export const collectCommentsMetadata = (pd: PdJson.Pd): CommentsMetadata => ({
    comments: discoverPdGuiComments(pd).map((comment) => {
        const layout = comment.node.layout || {}
        return {
            text: comment.text,
            position: {
                x: layout.x || 0,
                y: layout.y || 0,
            },
        }
    }),
})

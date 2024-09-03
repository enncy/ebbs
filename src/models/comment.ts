import { defineModel } from "src/core/plugins"

export class CommentDocument {
    uid: string
    user_uid: string
    post_uid: string
    parent_uid?: string
    content: string
    create_at: number
    statistics: {
        likes: number
        comments: number
    }
}
export const CommentModel = defineModel<CommentDocument>('Comment',
    {
        uid: { type: String, unique: true, required: true, index: true },
        user_uid: { type: String, required: true, index: true },
        post_uid: { type: String, required: true, index: true },
        parent_uid: { type: String, index: true },
        content: { type: String, required: true, index: 'text' },
        create_at: { type: Number, required: true },
        statistics: { 
            likes: { type: Number, default: 0 },
            comments: { type: Number, default: 0 }
        }
    },
    {
        collection: 'comments'
    }
)
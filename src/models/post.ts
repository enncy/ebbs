import { defineModel } from "src/core/plugins"

export class PostDocument {
    uid: string
    user_uid: string
    category_uid: string
    title: string
    content: string
    draft: boolean
    locked: boolean
    deleted: boolean
    post_at: number
    statistics: {
        likes: number
        comments: number
        views: number
    }
}
export const PostModel = defineModel<PostDocument>('Post',
    {
        uid: { type: String, unique: true, required: true, index: true },
        user_uid: { type: String, required: true, index: true },
        category_uid: { type: String, required: true, index: true },
        title: { type: String, required: true, index: 'text' },
        content: { type: String, required: true, index: 'text' },
        draft: { type: Boolean, default: false },
        locked: { type: Boolean, default: false },
        deleted: { type: Boolean, default: false },
        post_at: { type: Number, required: true },
        statistics: {
            likes: { type: Number, default: 0 },
            comments: { type: Number, default: 0 },
            views: { type: Number, default: 0 }
        }
    },
    {
        collection: 'posts'
    }
)
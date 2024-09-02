import { defineModel } from "src/core/plugins"

export class PostDocument {
    uid: string
    category_uid: string
    title: string
    content: string
}
export const PostModel = defineModel<PostDocument>('Post',
    {
        uid: { type: String, unique: true, required: true, index: true },
        category_uid: { type: String, required: true, index: true },
        title: { type: String, required: true, index: 'text' },
        content: { type: String, required: true, index: 'text' },
    },
    {
        collection: 'posts'
    }
)
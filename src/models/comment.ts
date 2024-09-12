import { defineModel } from "src/core/plugins"

export class CommentDocument {
    uid: string
    user_uid: string
    category_uid: string
    post_uid: string
    parent_uid?: string
    html: string
    text: string
    create_at: number

    public static count(post_id: string) {
        return CommentModel.countDocuments({ post_uid: post_id })
    }

    public static list(post_id: string, page: number, limit: number) {
        return CommentModel.find({ post_uid: post_id })
            .sort({ create_at: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
    }

}
export const CommentModel = defineModel<CommentDocument>('Comment',
    {
        uid: { type: String, unique: true, required: true, index: true },
        category_uid: { type: String, required: true, index: true },
        parent_uid: { type: String, index: true },
        user_uid: { type: String, required: true, index: true },
        post_uid: { type: String, required: true, index: true },
        html: { type: String, required: true, index: 'text' },
        text: { type: String, required: true, index: 'text' },
        create_at: { type: Number, required: true },
    },
    {
        collection: 'comments'
    }
)
import { defineModel } from "src/core/plugins"
import { randomShortId, uuid } from "./utils"

export class CommentDocument {
    uid: string
    short_id: string
    user_uid: string
    category_uid: string
    post_uid: string
    parent_uid?: string
    html: string
    text: string
    post_at: number
    statistics: { 
        comments: number
    }
 
    public static findByUid(uid: string) {
        return CommentModel.findOne({ uid: uid })
    }

    public static findByShortId(short_id: string) {
        return CommentModel.findOne({ short_id: short_id })
    }

    public static remove(uid: string) {
        return CommentModel.deleteOne({ uid: uid })
    }

    public static count(post_uid: string) {
        return CommentModel.countDocuments({ post_uid: post_uid })
    }

    public static list(post_uid: string, page: number, limit: number) {
        return CommentModel.find({ post_uid: post_uid })
            .sort({ post_at: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
    }


    public static async create(opts: { user_uid: string, category_uid: string, post_uid: string, html: string, text: string, parent_uid?: string }) {
        const short_id = await randomShortId(async (id) => !await CommentModel.findOne({ short_id: id }))
        return await CommentModel.create({
            uid: uuid(),
            short_id: short_id,
            user_uid: opts.user_uid,
            category_uid: opts.category_uid,
            post_uid: opts.post_uid,
            parent_uid: opts.parent_uid,
            html: opts.html,
            text: opts.text,
            post_at: Date.now(),
            statistics: {
                comments: 0
            }
        })
    }

}
export const CommentModel = defineModel<CommentDocument>('Comment',
    {
        uid: { type: String, unique: true, required: true, index: true },
        short_id: { type: String, unique: true, required: true, index: true },
        category_uid: { type: String, required: true, index: true },
        parent_uid: { type: String, index: true },
        user_uid: { type: String, required: true, index: true },
        post_uid: { type: String, required: true, index: true },
        html: { type: String, required: true, index: 'text' },
        text: { type: String, required: true, index: 'text' },
        post_at: { type: Number, required: true },
        statistics: { 
            comments: { type: Number, default: 0 }
        }
    },
    {
        collection: 'comments'
    }
)
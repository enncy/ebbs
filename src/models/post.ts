import { defineModel } from "src/core/plugins"
import { randomShortId, uuid } from "./utils"

export class PostDocument {
    uid: string
    short_id: string
    user_uid: string
    category_uid: string
    title: string
    content: string
    tags: string[]
    pin: boolean
    draft: boolean
    locked: boolean
    deleted: boolean
    enable_comment: boolean
    permissions: string[]
    post_at: number
    last_edit_at: number
    last_comment_at: number
    statistics: {
        likes: number
        comments: number
        views: number
    }

    public static async create({ user_uid, category_uid, title, content, tags }: { user_uid: string, category_uid: string, title: string, content: string, tags: string[] }) {
        const short_id = await randomShortId(async (id) => !await PostModel.findOne({ short_id: id }))
        return await PostModel.create<PostDocument>({
            uid: uuid(),
            short_id,
            user_uid,
            category_uid,
            title,
            content,
            tags,
            pin: false,
            draft: false,
            locked: false,
            deleted: false,
            enable_comment: true,
            post_at: Date.now(),
            last_edit_at: 0,
            last_comment_at: 0,
            permissions: [],
            statistics: { likes: 0, comments: 0, views: 0 }
        })
    }

    public static async togglePin(uid: string) {
        const post = await PostModel.findOne({ uid })
        if (!post) {
            return
        }
        post.pin = !post.pin
        return post.save()
    }

    public static async toggleDraft(uid: string) {
        const post = await PostModel.findOne({ uid })
        if (!post) {
            return
        }
        post.draft = !post.draft
        return post.save()
    }

    public static async toggleLock(uid: string) {
        const post = await PostModel.findOne({ uid })
        if (!post) {
            return
        }
        post.locked = !post.locked
        return post.save()
    }

    public static async delete(uid: string) {
        const post = await PostModel.findOne({ uid })
        if (!post) {
            return
        }
        post.deleted = true
        return post.save()
    }

    public static async update(uid: string, update: {
        title: string, content: string, tags: string[],
        permissions?: string[],
        pin?: boolean,
        draft?: boolean,
        locked?: boolean,
        deleted?: boolean,
        enable_comment?: boolean,
    }) {
        const post = await PostModel.findOne({ uid })
        if (!post) {
            return
        }
        post.title = update.title
        post.content = update.content
        post.tags = update.tags
        if (update.permissions !== undefined) {
            post.permissions = update.permissions
        }
        if (update.pin !== undefined) {
            post.pin = update.pin
        }
        if (update.draft !== undefined) {
            post.draft = update.draft
        }
        if (update.locked !== undefined) {
            post.locked = update.locked
        }
        if (update.deleted !== undefined) {
            post.deleted = update.deleted
        }
        if (update.enable_comment !== undefined) {
            post.enable_comment = update.enable_comment
        }
        post.last_edit_at = Date.now()
        return post.save()
    }
}
export const PostModel = defineModel<PostDocument>('Post',
    {
        uid: { type: String, unique: true, required: true, index: true },
        short_id: { type: String, unique: true, required: true, index: true },
        user_uid: { type: String, required: true, index: true },
        category_uid: { type: String, required: true, index: true },
        title: { type: String, required: true, index: 'text' },
        content: { type: String, required: true, index: 'text' },
        tags: { type: [String], default: [] },
        pin: { type: Boolean, default: false },
        draft: { type: Boolean, default: false },
        locked: { type: Boolean, default: false },
        deleted: { type: Boolean, default: false },
        enable_comment: { type: Boolean, default: true },
        post_at: { type: Number, required: true },
        last_edit_at: { type: Number, default: 0 },
        last_comment_at: { type: Number, default: 0 },
        permissions: { type: [String], default: [] },
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
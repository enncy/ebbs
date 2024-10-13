import { defineModel } from "src/core/plugins"
import { randomShortId, uuid } from "./utils"
import { ContentUtils } from "src/utils/content"
import similarity from 'string-similarity';
import { FilterQuery } from "mongoose"; 


export interface PostCreateParams {
    user_uid: string,
    category_uid: string,
    title: string,
    text: string,
    html: string,
    tags: string[],
    draft: boolean
}

export interface PostUpdateParams {
    title: string,
    html: string,
    text: string,
    tags: string[],
    permissions?: string[],
    pin?: boolean,
    draft?: boolean,
    locked?: boolean,
    deleted?: boolean,
    enable_comment?: boolean,
}

export class PostDocument {
    uid: string
    short_id: string
    user_uid: string
    category_uid: string
    title: string
    text: string
    html: string
    tags: string[]
    title_keywords: string[]
    text_keywords: string[]
    pin: boolean
    draft: boolean
    locked: boolean
    deleted: boolean
    permissions: string[]
    post_at: number
    last_edit_at: number
    last_comment_at: number
    statistics: {
        views: number
        comments: number
    }

    public static async findByUid(uid: string) {
        const post = await PostModel.findOne({ uid })
        if (!post) {
            return null
        }
        if (post.deleted || post.draft) {
            return null
        }
        return post
    }


    public static async findByShortId(short_id: string) {
        return await PostModel.findOne({ short_id })
    } 

    public static async list(filter: FilterQuery<PostDocument>, query: {  page: number, size: number }) {
        const posts = await PostModel.find(filter)
            .sort({ post_at: -1 })
            .skip((query.page - 1) * query.size)
            .limit(query.size)
        return posts
    }


    public static countByUser(user_uid: string) {
        return PostModel.countDocuments({ user_uid })
    }


    public static async count(query: { category_uid?: string, draft?: boolean, locked?: boolean, deleted?: boolean, user_uid?: string }) {
        return await PostModel.countDocuments(query)
    }

    public static async search(value: string) {
        const words = ContentUtils.extract(value)
        const common_filter = { deleted: false, draft: false, locked: false }
        const posts = await PostModel.find({
            $or: [
                { title_keywords: { $in: words }, ...common_filter },
                { text_keywords: { $in: words }, ...common_filter },
            ]
        })

        // 计算相似度
        for (const post of posts) {
            const rating = similarity.compareTwoStrings(post.title, value)
            console.log(value, post.title, rating);
            Reflect.set(post, 'rating', rating)
        }

        return posts.sort((a, b) => {
            const val = (post: PostDocument) => {
                return (post.post_at ? 1 : 0)
                    + (post.last_edit_at ? 1 : 0)
                    + (post.last_comment_at ? 1 : 0)
                    + (post.pin ? 1 : 0)
                    + (Reflect.get(post, 'rating') || 1) * 100
            }
            return val(b) - val(a)
        })
    }

    public static async create({ user_uid, category_uid, title, html, text, tags, draft }: PostCreateParams) {
        const short_id = await randomShortId(async (id) => !await PostModel.findOne({ short_id: id }))
        return await PostModel.create<PostDocument>({
            uid: uuid(),
            short_id,
            user_uid,
            category_uid,
            title,
            text,
            html,
            tags,
            title_keywords: ContentUtils.extract(title, 10),
            text_keywords: ContentUtils.extract(text),
            draft: draft,
            pin: false,
            locked: false,
            deleted: false,
            post_at: Date.now(),
            last_edit_at: 0,
            last_comment_at: 0,
            permissions: [],
            statistics: { comments: 0, views: 0 }
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
        title: string, html: string, text: string, tags: string[],
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
        post.tags = update.tags
        if (post.title !== update.title) {
            post.title = update.title
            post.title_keywords = ContentUtils.extract(update.title, 10)
        }
        if (post.text !== update.text) {
            post.text = update.text
            post.text_keywords = ContentUtils.extract(update.text)
        }
        if (post.html !== update.html) {
            post.html = update.html
        }
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
        html: { type: String, required: true, },
        text: { type: String, required: true, index: 'text' },
        tags: { type: [String], default: [] },
        title_keywords: { type: [String], default: [] },
        text_keywords: { type: [String], default: [] },
        pin: { type: Boolean, default: false },
        draft: { type: Boolean, default: false },
        locked: { type: Boolean, default: false },
        deleted: { type: Boolean, default: false },
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
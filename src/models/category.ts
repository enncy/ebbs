import { defineModel } from "src/core/plugins"
import { randomShortId, uuid } from "./utils"

export class CategoryDocument {
    uid: string
    short_id: string
    name: string
    description: string
    /**
     * 优先级，数字越小越靠前
     */
    priority: number
    /**
     * 置顶主题
     */
    pin_posts: string[]
    /**
     * 查看需要的权限
     */
    permissions: string[]
    deleted: boolean
    create_at: number
    statistics: {
        posts: number
        comments: number
        views: number
    }

    public static async create(name: string, description: string, priority: number = 0) {
        const short_id = await randomShortId(async (id) => !await CategoryModel.findOne({ short_id: id }))
        return await CategoryModel.create<CategoryDocument>({
            uid: uuid(),
            short_id,
            name,
            description,
            priority,
            pin_posts: [],
            permissions: [],
            deleted: false,
            create_at: Date.now(),
            statistics: { posts: 0, comments: 0, views: 0 }
        })
    }

    public static removeByUid(uid: string) {
        return CategoryModel.deleteOne({ uid })
    }

    public static updatePriority(uid: string, priority: number) {
        return CategoryModel.updateOne({ uid }, { priority })
    }

    public static findByUid(uid: string) {
        return CategoryModel.findOne({ uid })
    }

    public static findByShortId(id: string) {
        return CategoryModel.findOne({ short_id: id })
    }


    public static list() {
        return CategoryModel.find().sort({ priority: 1 })
    }
}
export const CategoryModel = defineModel<CategoryDocument>('Category',
    {
        uid: { type: String, unique: true, required: true, index: true },
        short_id: { type: String, unique: true, required: true, index: true },
        name: { type: String, unique: true, required: true, index: true },
        description: { type: String, required: true, index: 'text' },
        priority: { type: Number, default: 0 },
        pin_posts: { type: [String], default: [] },
        permissions: { type: [String], default: [] },
        deleted: { type: Boolean, default: false },
        create_at: { type: Number, required: true },
        statistics: {
            posts: { type: Number, default: 0 },
            comments: { type: Number, default: 0 },
            views: { type: Number, default: 0 }
        }
    },
    {
        collection: 'categories'
    }
)
import { defineModel } from "src/core/plugins"
import { uuid } from "./utils"

export class CategoryGroupDocument {
    uid: string
    name: string
    /**
     * 优先级，数字越小越靠前
     */
    priority: number

    public static async create(name: string, priority: number = 0) {
        return await CategoryGroupModel.create<CategoryGroupDocument>({
            uid: uuid(),
            name,
            priority,
        })
    }

    public static removeByUid(uid: string) {
        return CategoryGroupModel.deleteOne({ uid })
    }

    public static updatePriority(uid: string, priority: number) {
        return CategoryGroupModel.updateOne({ uid }, { priority })
    }

    public static async list() {
        return await CategoryGroupModel.find().sort({ priority: 1 })
    }
}
export const CategoryGroupModel = defineModel<CategoryGroupDocument>('CategoryGroup',
    {
        uid: { type: String, unique: true, required: true, index: true },
        name: { type: String, unique: true, required: true, index: true },
        priority: { type: Number, default: 0 },

    },
    {
        collection: 'category_groups'
    }
)
import { defineModel } from "src/core/plugins"

export class CategoryDocument {
    uid: string
    name: string
    description: string
    create_at: number
    statistics: {
        posts: number
        comments: number
        views: number
    }
}
export const CategoryModel = defineModel<CategoryDocument>('Category',
    {
        uid: { type: String, unique: true, required: true, index: true },
        name: { type: String, unique: true, required: true, index: true },
        description: { type: String, required: true, index: 'text' },
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
import { defineModel } from "src/core/plugins"

export class CategoryDocument {
    uid: string
    name: string
}
export const CategoryModel = defineModel<CategoryDocument>('Category',
    {
        uid: { type: String, unique: true, required: true, index: true },
        name: { type: String, unique: true, required: true, index: true },
    },
    {
        collection: 'categories'
    }
)
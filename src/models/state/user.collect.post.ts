import { defineModel } from "src/core/plugins"
import { PostDocument } from "../post"
export class UserCollectPostDocument {
    user_uid: string
    post_uid: string

    public static async isCollected(user_uid: string, post_uid: string): Promise<boolean> {
        return !!(await UserCollectPostModel.exists({ user_uid, post_uid }))
    }

    public static async toggle(user_uid: string, post_uid: string): Promise<void> {
        if (await UserCollectPostDocument.isCollected(user_uid, post_uid)) {
            await UserCollectPostModel.deleteOne({ user_uid, post_uid })
        } else {
            await UserCollectPostModel.create({ user_uid, post_uid })
        }
    }

    public static async list(user_uid: string, page: number, limit: number) {
        const records = await UserCollectPostModel.find({ user_uid })
            .sort({ post_at: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
  
        const posts = await Promise.all(records.map(async (record) => {
            return await PostDocument.findByUid(record.post_uid)
        }))

        return posts.filter(post => !!post)
    }

    public static count(user_uid: string) {
        return UserCollectPostModel.countDocuments({ user_uid })
    }
}
export const UserCollectPostModel = defineModel<UserCollectPostDocument>('UserCollectPost',
    {
        user_uid: { type: String, index: true },
        post_uid: { type: String, index: true },
    },
    {
        collection: 'user_collect_posts'
    }
)
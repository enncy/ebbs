import { defineModel } from "src/core/plugins"
export class UserLikePostDocument {
    user_uid: string
    post_uid: string

    public static async isLiking(user_uid: string, post_uid: string): Promise<boolean> {
        return !!(await UserLikePostModel.exists({ user_uid, post_uid }))
    }

    public static async toggle(user_uid: string, post_uid: string): Promise<void> {
        if (await UserLikePostDocument.isLiking(user_uid, post_uid)) {
            await UserLikePostModel.deleteOne({ user_uid, post_uid })
        } else {
            await UserLikePostModel.create({ user_uid, post_uid })
        }
    }

}
export const UserLikePostModel = defineModel<UserLikePostDocument>('UserLikePost',
    {
        user_uid: { type: String, index: true },
        post_uid: { type: String, index: true },
    },
    {
        collection: 'user_like_posts'
    }
)
import { defineModel } from "src/core/plugins"
export class UserFollowPostDocument {
    user_uid: string
    post_uid: string

    public static async isFollowing(user_uid: string, post_uid: string): Promise<boolean> {
        return !!(await UserFollowPostModel.exists({ user_uid, post_uid }))
    }

    public static async toggle(user_uid: string, post_uid: string): Promise<void> {
        if (await UserFollowPostDocument.isFollowing(user_uid, post_uid)) {
            await UserFollowPostModel.deleteOne({ user_uid, post_uid })
        } else {
            await UserFollowPostModel.create({ user_uid, post_uid })
        }
    }
}
export const UserFollowPostModel = defineModel<UserFollowPostDocument>('UserFollowPost',
    {
        user_uid: { type: String, index: true },
        post_uid: { type: String, index: true },
    },
    {
        collection: 'user_follow_posts'
    }
)
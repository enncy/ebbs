import { defineModel } from "src/core/plugins"
import { UserDocument } from "../user"
import { PostDocument } from "../post"
export class UserFollowPostDocument {
    user_uid: string
    post_uid: string

    public static async isFollowing(user: UserDocument, post: PostDocument): Promise<boolean> {
        return !!(await UserFollowPostModel.exists({ user_uid: user.uid, post_uid: post.uid }))
    }

    public static async toggle(user: UserDocument, post: PostDocument): Promise<void> {
        if (await UserFollowPostDocument.isFollowing(user, post)) {
            await UserFollowPostModel.deleteOne({ user_uid: user.uid, post_uid: post.uid })
        } else {
            await UserFollowPostModel.create({ user_uid: user.uid, post_uid: post.uid })
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
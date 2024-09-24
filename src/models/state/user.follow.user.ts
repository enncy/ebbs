import { defineModel } from "src/core/plugins"
import { UserDocument } from "../user"
export class UserFollowUserDocument {
    user_uid: string
    target_uid: string

    public static async isFollowing(user: UserDocument, target: UserDocument): Promise<boolean> {
        return !!(await UserFollowUserModel.exists({ user_uid: user.uid, target_uid: target.uid }))
    }

    public static async toggle(user: UserDocument, target: UserDocument): Promise<void> {
        if (await UserFollowUserDocument.isFollowing(user, target)) {
            await UserFollowUserModel.deleteOne({ user_uid: user.uid, target_uid: target.uid })
        } else {
            await UserFollowUserModel.create({ user_uid: user.uid, target_uid: target.uid })
        }
    }
}
export const UserFollowUserModel = defineModel<UserFollowUserDocument>('UserFollowUser',
    {
        user_uid: { type: String, index: true },
        target_uid: { type: String, index: true },
    },
    {
        collection: 'user_follow_users'
    }
)
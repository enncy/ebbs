import { defineModel } from "src/core/plugins"
import { UserDocument } from "../user"
export class UserFollowUserDocument {
    user_uid: string
    target_uid: string

    public static async isFollowing(user: UserDocument, target: UserDocument): Promise<boolean> {
        return !!(await UserFollowUserModel.exists({ user_uid: user.uid, target_uid: target.uid }))
    }
 

    public static async list(filter: { user_uid?: string, target_uid?: string }, page: number, limit: number) {
        if(!filter.user_uid && !filter.target_uid) {
            throw new Error('filter.user_uid or filter.target_uid is required')
        }
        const records = await UserFollowUserModel.find(filter)
            .sort({ post_at: -1 })
            .skip((page - 1) * limit)
            .limit(limit)

        const users = await Promise.all(records.map(async (record) => {
            return await UserDocument.findOne({ uid: record.target_uid })
        }))

        return users.filter(user => !!user)
    } 

    public static async listAll(filter: { user_uid?: string, target_uid?: string }) {
        if(!filter.user_uid && !filter.target_uid) {
            throw new Error('filter.user_uid or filter.target_uid is required')
        } 
        return await UserFollowUserModel.find(filter)
    }

    public static count(filter: { user_uid?: string, target_uid?: string }) {
        if(!filter.user_uid && !filter.target_uid) {
            throw new Error('filter.user_uid or filter.target_uid is required')
        }
        return UserFollowUserModel.countDocuments(filter)
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
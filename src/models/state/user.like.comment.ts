import { defineModel } from "src/core/plugins"
export class UserLikeCommentDocument {
    user_uid: string
    comment_uid: string

    public static async isLiking(user_uid: string, comment_uid: string): Promise<boolean> {
        return !!(await UserLikeCommentModel.exists({ user_uid, comment_uid }))
    }

    public static async toggle(user_uid: string, comment_uid: string): Promise<void> {
        if (await UserLikeCommentDocument.isLiking(user_uid, comment_uid)) {
            await UserLikeCommentModel.deleteOne({ user_uid, comment_uid })
        } else {
            await UserLikeCommentModel.create({ user_uid, comment_uid })
        }
    }

}
export const UserLikeCommentModel = defineModel<UserLikeCommentDocument>('UserLikeComment',
    {
        user_uid: { type: String, index: true },
        comment_uid: { type: String, index: true },
    },
    {
        collection: 'user_like_comments'
    }
)
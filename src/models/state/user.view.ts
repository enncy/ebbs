import { defineModel } from "src/core/plugins"
export class UserViewDocument {
    user_uid: string
    post_uid: string

    public static async view(user_uid: string, post_uid: string) {
        if (await UserViewModel.exists({ user_uid, post_uid })) {
            return false
        }
        await UserViewModel.create({ user_uid, post_uid })
        return true
    }
}
export const UserViewModel = defineModel<UserViewDocument>('UserView',
    {
        user_uid: { type: String, index: true },
        post_uid: { type: String, index: true },
    },
    {
        collection: 'user_views'
    }
)
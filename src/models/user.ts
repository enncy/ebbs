import { defineModel } from "src/core/plugins"
import { uuid } from "./utils"

export class UserDocument {
    uid!: string
    nickname!: string
    email!: string
    password!: string
    profile: string
    permissions: string[]
    banned: boolean

    public static create(nickname: string, email: string, passport: string) {
        return UserModel.create({
            uid: uuid(),
            nickname: nickname,
            email: email,
            password: passport,
            profile: '',
            permissions: [],
            banned: false
        })
    }

    public static findByEmail(email: string) {
        return UserModel.findOne({ email })
    }

    public static resetPassword(email: string, password: string) {
        return UserModel.updateOne({ email }, {
            password
        })
    }
}
export const UserModel = defineModel<UserDocument>('User',
    {
        uid: { type: String, unique: true, required: true, index: true },
        email: { type: String, unique: true, required: true, index: true },
        password: { type: String, required: true },
        nickname: { type: String, required: true, index: true, default: '' },
        profile: { type: String, default: '' },
        permissions: { type: [String], default: [] },
        banned: { type: Boolean, default: false }
    },
    {
        collection: 'users'
    }
)
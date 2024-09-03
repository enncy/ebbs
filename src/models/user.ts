import { defineModel } from "src/core/plugins"
import { uuid } from "./utils"
import { SignUtils } from "src/utils"

export class UserDocument {
    uid: string
    nickname: string
    email: string
    password: string
    password_salt: string
    avatar: string
    profile: string
    permissions: string[]
    banned: boolean
    register_at: number
    register_ip: string
    last_login_at: number
    last_login_ip: string
    statistics: {
        posts: number
        comments: number
        likes: number
        fans: number
    }

    public static create(nickname: string, email: string, passport: string, ip: string) {
        const now = Date.now()
        const salt = uuid()
        const signed_password = SignUtils.sign({ passport, salt })
        return UserModel.create({
            uid: uuid(),
            nickname: nickname,
            email: email,
            password: signed_password,
            password_salt: salt,
            avatar: '',
            profile: '',
            permissions: [],
            banned: false,
            register_at: now,
            register_ip: ip,
            last_login_at: now,
            last_login_ip: '',
            statistics: {}
        })
    }

    public static async findByEmail(email: string) {
        return await UserModel.findOne({ email })
    }

    public static async findByEmailAndPassword(email: string, password: string) {
        const user = await this.findByEmail(email)
        if (!user) {
            return null
        }
        const signed_password = SignUtils.sign({ passport: password, salt: user.password_salt })
        if (signed_password === user.password) {
            return user
        }
        return null
    }

    public static async login(email: string, password: string, ip: string) {
        const user = await this.findByEmailAndPassword(email, password)
        if (user) {
            user.last_login_ip = ip
            user.last_login_at = Date.now()
            await UserModel.updateOne({ email }, {
                last_login_ip: ip,
                last_login_at: user.last_login_at,
            })
            return user
        }
        return null
    }

    public static signPassword(password: string, salt: string) {
        return SignUtils.sign({ passport: password, salt })
    }

    public static resetPassword(email: string, password: string) {
        const salt = uuid()
        const signed_password = SignUtils.sign({ passport: password, salt })
        return UserModel.updateOne({
            email
        }, {
            password: signed_password,
            password_salt: salt
        })
    }
}
export const UserModel = defineModel<UserDocument>('User',
    {
        uid: { type: String, unique: true, required: true, index: true },
        email: { type: String, unique: true, required: true, index: true },
        password: { type: String, required: true },
        password_salt: { type: String, required: true },
        nickname: { type: String, required: true, index: true, default: '' },
        profile: { type: String, default: '' },
        avatar: { type: String, default: '' },
        permissions: { type: [String], default: [] },
        banned: { type: Boolean, default: false },
        register_at: { type: Number, default: Date.now },
        register_ip: { type: String, default: '' },
        last_login_at: { type: Number, default: Date.now },
        last_login_ip: { type: String, default: '' },
        statistics: {
            posts: { type: Number, default: 0 },
            comments: { type: Number, default: 0 },
            likes: { type: Number, default: 0 },
            fans: { type: Number, default: 0 }
        }
    },
    {
        collection: 'users'
    }
)
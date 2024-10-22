import { defineModel } from "src/core/plugins"
import { uuid } from "./utils"
import { SignUtils } from "src/utils"
import { FilterQuery } from "mongoose"

export class UserDocument {
    uid: string
    account: string
    nickname: string
    email: string
    password: string
    password_salt: string
    avatar: string
    profile: string
    profile_background: string
    permissions: string[]
    banned: boolean
    deleted: boolean
    register_at: number
    register_ip: string
    last_login_at: number
    last_login_ip: string
    statistics: {
        posts: number
        comments: number
        follows: number
        fans: number
    }

    public static async create(account: string, email: string, passport: string, ip: string) {
        const now = Date.now()
        const salt = uuid()
        const signed_password = SignUtils.sign({ passport, salt })
        return await UserModel.create({
            uid: uuid(),
            account: account,
            nickname: '',
            email: email,
            password: signed_password,
            password_salt: salt,
            avatar: '',
            profile: '',
            profile_background: '',
            permissions: [],
            banned: false,
            deleted: false,
            register_at: now,
            register_ip: ip,
            last_login_at: now,
            last_login_ip: '',
            statistics: {}
        })
    }

    public static async findOne(or: { email?: string, account?: string, uid?: string }) {
        if (!or.email && !or.account && !or.uid) {
            return null
        }
        return await UserModel.findOne({ $or: [{ email: or.email }, { account: or.account }, { uid: or.uid }] })
    }

    public static async findByEmailAndPassword(email: string, password: string) {
        const user = await this.findOne({ email })
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


    public static list(filter: FilterQuery<UserDocument>, pagination: { page: number, size: number }) {
        return UserModel.find(filter).skip((pagination.page - 1) * pagination.size).limit(pagination.size)
    }


    public static count(filter: FilterQuery<UserDocument>) {
        return UserModel.countDocuments(filter)
    }

    public static ban(uid: string) {
        return UserModel.updateOne({ uid }, { banned: true })
    }

    public static unban(uid: string) {
        return UserModel.updateOne({ uid }, { banned: false })
    }

    public static remove(uid: string) {
        return UserModel.updateOne({ uid }, { deleted: true })
    }

    public static recover(uid: string) {
        return UserModel.updateOne({ uid }, { deleted: false })
    }

    public static permissions(uid: string, permissions: string[]) {
        return UserModel.updateOne({
            uid
        }, {
            permissions
        })
    }
}
export const UserModel = defineModel<UserDocument>('User',
    {
        uid: { type: String, unique: true, required: true, index: true },
        account: { type: String, unique: true, required: true, index: true },
        email: { type: String, unique: true, required: true, index: true },
        password: { type: String, required: true },
        password_salt: { type: String, required: true },
        nickname: { type: String, index: true, default: '' },
        profile: { type: String, default: '' },
        profile_background: { type: String, default: '' },
        avatar: { type: String, default: '' },
        permissions: { type: [String], default: [] },
        banned: { type: Boolean, default: false },
        deleted: { type: Boolean, default: false },
        register_at: { type: Number, default: Date.now },
        register_ip: { type: String, default: '' },
        last_login_at: { type: Number, default: Date.now },
        last_login_ip: { type: String, default: '' },
        statistics: {
            posts: { type: Number, default: 0 },
            comments: { type: Number, default: 0 },
            follows: { type: Number, default: 0 },
            fans: { type: Number, default: 0 }
        }
    },
    {
        collection: 'users'
    }
)
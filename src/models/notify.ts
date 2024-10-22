import { defineModel } from "src/core/plugins"
import { uuid } from "./utils"

export type NotifyType = 'system' | 'reply-comment' | 'reply-post' | 'followed'

export class NotifyDocument {
    uid: string
    sender_uid?: string
    receiver_uid: string
    type: NotifyType
    data: {
        reply_comment?: { 
            comment_uid: string
            comment_text: string
            comment_short_id: string
            parent_uid: string
            parent_text: string
            parent_short_id: string
            sender_uid: string
            sender_account: string
            sender_nickname: string
        }
        reply_post?: {
            post_uid: string
            post_short_id: string
            post_title: string
            comment_uid: string 
            comment_text: string
            sender_uid: string
            sender_account: string
            sender_nickname: string
        },
        followed?: {
            post_short_id: string
            post_uid: string
            post_title: string
            author_uid: string
            author_account: string
            author_nickname: string
        }
    }
    read: boolean
    create_at: number

    public static findByUid(uid: string) {
        return NotifyModel.findOne({ uid: uid })
    }

    public static create(opts: {
        sender_uid?: string
        receiver_uid: string,
        type: NotifyType,
        data: NotifyDocument['data']
    }) {
        return NotifyModel.create({
            uid: uuid(),
            sender_uid: opts.sender_uid,
            receiver_uid: opts.receiver_uid,
            type: opts.type,
            data: opts.data,
            create_at: Date.now()
        })
    }


    public static countUnread(receiver_uid: string) {
        return NotifyModel.countDocuments({ receiver_uid, read: false })
    }
}
export const NotifyModel = defineModel<NotifyDocument>('Notify',
    {
        uid: { type: String, required: true },
        sender_uid: { type: String },
        receiver_uid: { type: String, required: true },
        type: { type: String, required: true },
        data: { type: Object, required: true },
        read: { type: Boolean, required: true, default: false },
        create_at: { type: Number, required: true }
    },
    {
        collection: 'notify'
    }
)
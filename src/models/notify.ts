import { defineModel } from "src/core/plugins"
import { uuid } from "./utils"

export type NotifyType = 'system' | 'reply-comment' | 'reply-post'

export class NotifyDocument {
    uid: string
    sender_uid?: string
    receiver_uid: string
    type: NotifyType
    data: {
        reply_comment?: {
            parent_uid: string
            comment_uid: string
        }
        reply_post?: {
            post_uid: string
            comment_uid: string
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
import { defineModel } from "src/core/plugins"
import { uuid } from "./utils"

export type AnnouncementType =  'success' | 'info' | 'warning' | 'danger'

export class AnnouncementDocument {
    uid: string
    priority: number
    type: AnnouncementType
    content: string

    public static async create(content: string, type: AnnouncementType, priority: number) {
        return await AnnouncementModel.create<AnnouncementDocument>({
            uid: uuid(),
            priority,
            content,
            type
        })
    }

    public static list() {
        return AnnouncementModel.find().sort({ priority: 1 })
    }

    public static removeByUid(uid: string) {
        return AnnouncementModel.deleteOne({ uid })
    }
}
export const AnnouncementModel = defineModel<AnnouncementDocument>('Announcement',
    {
        uid: { type: String, unique: true, required: true, index: true },
        priority: { type: Number, default: 0 },
        content: { type: String, required: true },
        type: { type: String, required: true }
    },
    {
        collection: 'announcements'
    }
)
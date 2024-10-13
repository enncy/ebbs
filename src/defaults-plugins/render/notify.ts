import { Plugin } from "src/core/plugins";
import { UserPostCommentEvent } from ".";
import { NotifyDocument, NotifyType } from "src/models/notify";


export function notify(plugin: Plugin) {

    plugin.on(UserPostCommentEvent, async e => {
        // 如果自己回复自己，则不通知
        if (e.user.uid !== e.post.user_uid) { 

            // 评论通知
            const type: NotifyType = e.comment.parent_uid ? 'reply-comment' : 'reply-post'
            const data: NotifyDocument["data"] = {}
            if (e.comment.parent_uid) {
                data.reply_comment = {
                    comment_uid: e.comment.uid,
                    parent_uid: e.comment.parent_uid
                }
            }
            if (type === 'reply-post') {
                data.reply_post = {
                    post_uid: e.post.uid,
                    comment_uid: e.comment.uid
                }
            }
            await NotifyDocument.create({
                sender_uid: e.user.uid,
                receiver_uid: e.post.user_uid,
                type: type,
                data
            })
        }

    })


}
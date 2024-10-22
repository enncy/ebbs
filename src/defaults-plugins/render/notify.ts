import { Plugin } from "src/core/plugins";
import { UserCreatePostEvent, UserPostCommentEvent } from ".";
import { NotifyDocument, NotifyType } from "src/models/notify";
import { UserFollowUserDocument } from "src/models/state/user.follow.user";
import { CommentDocument } from "src/models/comment";


export function notify(plugin: Plugin) {

    plugin.on(UserPostCommentEvent, async e => {
        // 如果自己回复自己，则不通知
        if (e.user.uid !== e.post.user_uid) {

            // 评论通知
            const type: NotifyType = e.comment.parent_uid ? 'reply-comment' : 'reply-post'
            const data: NotifyDocument["data"] = {}

            if (e.comment.parent_uid) {
                const parent = await CommentDocument.findByUid(e.comment.parent_uid)
                if (parent) {
                    data.reply_comment = {
                        comment_uid: e.comment.uid,
                        comment_text: e.comment.text,
                        comment_short_id: e.comment.short_id,
                        parent_short_id: parent.short_id,
                        parent_uid: parent.uid,
                        parent_text: parent.text || '',
                        sender_uid: e.user.uid,
                        sender_nickname: e.user.nickname,
                        sender_account: e.user.account
                    }
                }

            }
            if (type === 'reply-post') {
                data.reply_post = {
                    post_uid: e.post.uid,
                    post_short_id: e.post.short_id,
                    post_title: e.post.title,
                    comment_uid: e.comment.uid,
                    comment_text: e.comment.text,
                    sender_uid: e.user.uid,
                    sender_nickname: e.user.nickname,
                    sender_account: e.user.account
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


    plugin.on(UserCreatePostEvent, async e => {
        UserFollowUserDocument.listAll({ target_uid: e.post.user_uid }).then(async (list) => {
            for (const item of list) {
                await NotifyDocument.create({ 
                    receiver_uid: item.user_uid,
                    type: 'followed',
                    data: {
                        followed: {
                            post_uid: e.post.uid,
                            post_short_id: e.post.short_id,
                            post_title: e.post.title,
                            author_uid: e.post.user_uid,
                            author_account: e.user.account,
                            author_nickname: e.user.nickname
                        }
                    }
                })
            }
        })
    })


}
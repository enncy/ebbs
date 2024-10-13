
import { Plugin } from 'src/core/plugins';
import { PostRenderEvent, UserCreatePostEvent, UserPostCommentEvent, UserRemoveCommentEvent } from '.';
import { UserViewDocument } from 'src/models/state/user.view';
import { UserModel } from 'src/models/user';
import { CategoryModel } from 'src/models/category';
import { PostModel } from 'src/models/post';


export function statistic(plugin: Plugin) {
    plugin.on(PostRenderEvent, async e => {
        // 增加访问量
        if (e.user) {  
            // 访问记录
            if (await UserViewDocument.view(e.user.uid, e.post.uid)) {
                // 增加访问量
                await e.post.updateOne({ $inc: { 'statistics.views': 1 } })
            }
        }
    })

    plugin.on(UserCreatePostEvent, async e => {
        await UserModel.updateOne({ uid: e.user.uid }, { $inc: { 'statistics.posts': 1 } })
        await e.category.updateOne({ $inc: { 'statistics.posts': 1 } })
    })

    plugin.on(UserPostCommentEvent, async e => {
        await e.post.updateOne({ $inc: { 'statistics.comments': 1 } })
        await e.category.updateOne({ $inc: { 'statistics.comments': 1 } })
        await UserModel.updateOne({ uid: e.user.uid }, { $inc: { 'statistics.comments': 1 } })
    })

    plugin.on(UserRemoveCommentEvent, async e => {
        await PostModel.updateOne({ uid: e.comment.post_uid }, { $inc: { 'statistics.comments': -1 } })
        await CategoryModel.updateOne({ uid: e.comment.category_uid }, { $inc: { 'statistics.comments': -1 } })
        await UserModel.updateOne({ uid: e.user.uid }, { $inc: { 'statistics.comments': -1 } })
    })
}
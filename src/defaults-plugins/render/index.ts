import { global_config } from "ebbs.config";
import { join, resolve } from "path";
import { definePlugin } from "src/core/plugins";
import { CategoryDocument } from "src/models/category";
import { hasBlankParams } from "src/utils";
import { i18n } from "../i18n";
import fs from 'fs';
import { PassportPlugin, permission } from "../passport";
import dayjs from 'dayjs';
import { PostCreateParams, PostDocument, PostModel, PostUpdateParams } from "src/models/post";
import { ContentUtils } from "src/utils/content";
import { CommentCreateParams, CommentDocument, CommentModel } from "src/models/comment";
import { UserDocument } from "src/models/user";
import { CategoryGroupDocument } from "src/models/category_group";
import { UserCollectPostDocument } from "src/models/state/user.collect.post";
import { CancellableEvent, Event } from "src/core/interfaces";
import { Document } from "mongoose";
import { statistic } from "./statistic";
import { notify } from "./notify";
import { Request, Response } from "express";
import { UserAttachment } from "src/utils/file";

export class UserPreCreatePostEvent extends CancellableEvent {
    constructor(public user: UserDocument, public params: PostCreateParams) {
        super()
    }
}

export class UserCreatePostEvent extends Event {
    constructor(public user: UserDocument, public category: Document & CategoryDocument, public post: Document & PostDocument) {
        super()
    }
}

export class UserPreUpdatePostEvent extends CancellableEvent {
    constructor(public user: UserDocument, public post: Document & PostDocument, public params: PostUpdateParams) {
        super()
    }
}

export class UserUpdatePostEvent extends Event {
    constructor(public user: UserDocument, public post: Document & PostDocument, public params: PostUpdateParams) {
        super()
    }
}


export class PostRenderEvent extends CancellableEvent {
    constructor(public post: Document & PostDocument, public user?: UserDocument) {
        super()
    }
}

export class UserCollectPostEvent extends CancellableEvent {
    constructor(public user: UserDocument, public post_uid: string) {
        super()
    }
}

export class UserPrePostCommentEvent extends CancellableEvent {
    constructor(public user: UserDocument, public params: CommentCreateParams) {
        super()
    }
}

export class UserPostCommentEvent extends Event {
    constructor(public user: UserDocument, public category: Document & CategoryDocument, public post: Document & PostDocument, public comment: Document & CommentDocument) {
        super()
    }
}

export class UserRemoveCommentEvent extends CancellableEvent {
    constructor(public user: UserDocument, public comment: Document & CommentDocument) {
        super()
    }
}

definePlugin({
    id: 'render',
    name: 'render-plugin'
}, (plugin) => {

    // 开启统计
    statistic(plugin)
    // 开启通知
    notify(plugin)


    const indexView = plugin.definedView('index.ejs', async () => {
        const category_groups = await CategoryGroupDocument.list()
        const category_docs = await CategoryDocument.list()

        return {
            other_categories: category_docs.filter(c => !c.group_uid),
            category_groups: category_groups.map(g => ({ ...g.toJSON(), children: category_docs.filter(c => c.group_uid === g.uid).map(c => c.toJSON()) }))
                .filter(g => g.children.length > 0),
            newest_posts: await Promise.all((await PostModel.find({ draft: false, deleted: false }).sort({ create_at: -1 }).limit(10)).map(async p => {
                return { ...p.toJSON(), user: await UserDocument.findOne({ uid: p.user_uid }) }
            })),
            newest_comments: await Promise.all((await CommentModel.find().sort({ create_at: -1 }).limit(10)).map(async c => {
                return { ...c.toJSON(), user: await UserDocument.findOne({ uid: c.user_uid }) }
            }))
        }
    })

    const categoryView = plugin.definedView('category.ejs')


    plugin.definePage({
        path: '/',
        custom_path: true,
        render: indexView.render
    })

    plugin.definePage({
        path: '/category',
        custom_path: true,
        render: async (req) => {
            const id = req.query.id?.toString().trim()
            const page = req.query.p?.toString().trim() || '1'
            const sort = req.query.sort?.toString().trim() || 'default'
            if (hasBlankParams(id, page)) {
                return
            }
            const cat = await CategoryDocument.findByShortId(id!)
            if (!cat) {
                return
            }
            const size = global_config.category.pagination.size
            let page_value = parseInt(page!)
            if (isNaN(page_value)) {
                return
            }
            page_value = Math.min(Math.max(1, page_value), global_config.category.max_page)
            const post_docs = await PostDocument.list({ category_uid: cat.uid }, { page: page_value, size: size }, { sort: sort as any })
            const post_count = await PostDocument.count({ category_uid: cat.uid })
            const posts = await Promise.all(post_docs.map(async p => {
                const user = await UserDocument.findOne({ uid: p.user_uid })
                return { ...p, user: user?.toJSON() }
            }))
            return await categoryView.render(req, { category: cat, posts, total_page: Math.ceil(post_count / size) })
        }
    })



})



const PostPlugin = definePlugin({
    id: 'post',
    name: 'post-plugin',
    apis: {
        '/search': 'post',
        '/editor': 'post',
        '/upload': 'post',
        '/comment': 'post',
        '/collect': 'get',
        '/remove-comment': 'get',
        '/comment-redirect': 'get', // TODO
    },
    sessions: {
        latest_upload_time: Number
    },
}, (plugin, app) => {
    const postEditorView = plugin.definedView('post.editor.ejs', async () => {
        return { video_supports: global_config.post.video_supports, upload_file_size_limit: global_config.post.upload_file_size_limit, ...global_config.post.content }
    })

    const postView = plugin.definedView('post.ejs', () => {
        return { video_supports: global_config.post.video_supports, upload_file_size_limit: global_config.post.upload_file_size_limit, ...global_config.post.content }
    })

    const searchResultsView = plugin.definedView('search.results.ejs')

    plugin.api('/search', permission(), async (req, res) => {
        const { value, category_uid, user_uid } = req.body
        if (hasBlankParams(value)) {
            return plugin.sendError(req, res, 400)
        }

        const filter = Object.create({})
        if (category_uid) {
            filter.category_uid = category_uid
        }
        if (user_uid) {
            filter.user_uid = user_uid
        }

        const results = await PostDocument.search(value, { ...filter, draft: false, deleted: false, locked: false })
        results.slice(0, global_config.post.pagination.size)
        res.send(await searchResultsView.render(req, {
            results: await Promise.all(results.map(async r => {
                return { ...r.toJSON(), user: await UserDocument.findOne({ uid: r.user_uid }) }
            }))
        }))
    })

    plugin.definePage({
        path: '/editor',
        render: async (req, res) => {
            const user = PassportPlugin.sessions.get(req, 'user')
            if (user === undefined) {
                return res.redirect('/passport/login')
            }
            // post_short_id
            const pid = req.query.pid?.toString().trim()
            const post = pid ? await PostDocument.findByShortId(pid) : null

            if (post && post.user_uid !== user.uid) {
                return plugin.sendError(req, res, 403)
            }
            return postEditorView.render(req, {
                defaults: {
                    title: post?.title || '',
                    text: post?.text || '',
                    html: post?.html || '',
                    tags: post?.tags || [],
                    draft: post?.draft || false
                }
            })
        }
    })



    plugin.api('/upload', permission(), async (req, res) => {
        // 上传频率检测
        const latest_upload_time = plugin.sessions.get(req, 'latest_upload_time')
        if (latest_upload_time !== undefined) {
            if (Date.now() - latest_upload_time < global_config.post.upload.period * 1000) {
                return res.send({
                    error: i18n('post.upload.too_frequent')
                })
            }
        }
        plugin.sessions.set(req, 'latest_upload_time', Date.now())

        const user = PassportPlugin.sessions.get(req, 'user')!

        const file = Array.isArray(req.files?.file) ? req.files?.file[0] : req.files?.file

        if (!file) {
            return res.send({
                error: i18n('post.upload.file_empty')
            })
        }

        if (file?.mimetype !== 'image/jpeg' && file?.mimetype !== 'image/png') {
            return res.send({
                error: i18n('post.upload.file_not_support')
            })
        }


        try {
            const date = dayjs().format('YYYY-MM-DD')
            const ua = UserAttachment.of(user, date)
            const { url } = await ua.addImage(file) || {}
            if (!url) {
                throw new Error(i18n('post.upload.file_error', { error_message: 'add attachment failed' }))
            }

            return res.send({
                url
            })
        } catch (e) {
            return res.send({
                error: i18n('post.upload.file_error', { error_message: e.message })
            })
        }
    })


    plugin.api('/collect', permission(), async (req, res) => {
        const user = PassportPlugin.sessions.get(req, 'user')!
        const uid = req.query.uid?.toString()?.trim() || ''
        if (hasBlankParams(uid)) {
            return plugin.sendError(req, res, 400)
        }

        const e = new UserCollectPostEvent(user, uid)
        await plugin.emit(e)
        if (e.isCancelled()) {
            return plugin.sendError(req, res, 403, e.reason)
        }

        await UserCollectPostDocument.toggle(user.uid, uid)
        res.sendStatus(200)
    })


    plugin.api('/comment', permission(), plugin.validator((req) => req.body, {
        text: {
            type: 'string', name: i18n('_model_.post.content'), required: true,
            min_length: global_config.post.content.content_min_length,
            max_length: global_config.post.content.content_max_length
        },
        category_uid: { type: 'string', required: true },
        post_uid: { type: 'string', required: true },
    }), async (req, res) => {
        const { html, text, category_uid, parent_uid, deleted_images = '[]', post_uid = '' } = req.body
        const user = PassportPlugin.sessions.get(req, 'user')!

        // 分区检测
        const category = await CategoryDocument.findByUid(category_uid)
        if (!category) {
            return plugin.sendError(req, res, 404)
        }

        // 删除未使用的图片
        const deleted_images_array = JSON.parse(deleted_images)
        if (Array.isArray(deleted_images_array) === false) {
            return plugin.sendError(req, res, 400)
        }
        await Promise.all(deleted_images_array.map(path => {
            return UserAttachment.deleteAttachment(path)
        }))

        // 敏感词检测
        const text_sensitive_words = ContentUtils.detectSensitiveWords(text)
        if (text_sensitive_words) {
            return plugin.sendError(req, res, 400, i18n('post.form.content_has_sensitive_words', { words: text_sensitive_words.join(',') }))
        }

        // 帖子检测
        const post = await PostDocument.findByUid(post_uid)
        if (!post) {
            return plugin.sendError(req, res, 400, i18n('post.error.post_not_exist'))
        }


        const params = { user_uid: user.uid, category_uid, post_uid, parent_uid, text, html }

        const e = new UserPrePostCommentEvent(user, params)
        await plugin.emit(e)
        if (e.isCancelled()) {
            return plugin.sendError(req, res, 403, e.reason)
        }

        const comment = await CommentDocument.create({ user_uid: user.uid, category_uid, post_uid, parent_uid, text, html })

        const event = new UserPostCommentEvent(user, category, post, comment)
        await plugin.emit(event)


        res.redirect(`/p/${post.short_id}`)
    })


    plugin.api('/remove-comment', permission(), async (req, res) => {
        // comment_short_id
        const cid = req.query.cid?.toString()?.trim() || ''
        // post_short_id
        const pid = req.query.pid?.toString()?.trim() || ''
        if (hasBlankParams(cid)) {
            return plugin.sendError(req, res, 400)
        }
        const user = PassportPlugin.sessions.get(req, 'user')!
        const comment = await CommentDocument.findByShortId(cid)
        if (!comment) {
            return plugin.sendError(req, res, 404)
        }
        if (comment.user_uid !== user.uid) {
            return plugin.sendError(req, res, 403)
        }

        const e = new UserRemoveCommentEvent(user, comment)
        await plugin.emit(e)
        if (e.isCancelled()) {
            return plugin.sendError(req, res, 403, e.reason)
        }

        await CommentDocument.remove(comment.uid)

        res.redirect(`/p/${pid}`)
    })


    plugin.api('/comment-redirect', permission(), async (req, res) => {
        // comment_short_id
        const cid = req.query.cid?.toString()?.trim()
        const uid = req.query.uid?.toString()?.trim()
        if (!cid && !uid) {
            return plugin.sendError(req, res, 400)
        }

        const comment = cid ? await CommentDocument.findByShortId(cid) : uid ? await CommentDocument.findByUid(uid) : undefined
        if (!comment) {
            return plugin.sendError(req, res, 404)
        }

        const post = await PostDocument.findByUid(comment.post_uid)
        if (!post) {
            return plugin.sendError(req, res, 404)
        }

        const count = await CommentDocument.count(post.uid)

        for (let page = 1; (page - 1) * global_config.post.pagination.size < count; page++) {
            const comment_docs = await CommentDocument.list(post.uid, page, global_config.post.pagination.size)
            const result = comment_docs.find(c => (c.short_id === cid || c.uid === uid))
            if (result) {
                return res.redirect(`/p/${post.short_id}?p=${page}#${result.short_id.slice(0, 6)}`)
            }
        }

        return plugin.sendError(req, res, 404)
    })


    plugin.api('/editor', permission(), plugin.validator((req) => req.body, {
        title: {
            type: 'string', name: i18n('_model_.post.title'), required: true,
            min_length: global_config.post.content.title_min_length,
            max_length: global_config.post.content.title_max_length
        },
        text: {
            type: 'string', name: i18n('_model_.post.content'), required: true,
            min_length: global_config.post.content.content_min_length,
            max_length: global_config.post.content.content_max_length
        },
        category_uid: {
            type: 'string', required: true
        },
    }, postEditorView), async (req, res) => {
        const { title, html, text, category_uid, pid, deleted_images = '[]', tags = '', draft = '' } = req.body

        const user = PassportPlugin.sessions.get(req, 'user')!



        // 删除未使用的图片
        const deleted_images_array = JSON.parse(deleted_images)
        if (Array.isArray(deleted_images_array) === false) {
            return plugin.sendError(req, res, 400)
        }
        await Promise.all(deleted_images_array.map(path => {
            return UserAttachment.deleteAttachment(path)
        }))

        const draft_value = draft === 'on'
        const tags_value = String(tags).split(/[\s,，]/).filter(tag => !!tag.trim())

        // 敏感词检测
        const tags_sensitive_words = ContentUtils.detectSensitiveWords(tags_value)
        if (tags_sensitive_words) {
            return res.send(await postEditorView.render(req, { error: i18n('post.form.tags_has_sensitive_words', { words: tags_sensitive_words.join(',') }) }))
        }
        const title_sensitive_words = ContentUtils.detectSensitiveWords(title)
        if (title_sensitive_words) {
            return res.send(await postEditorView.render(req, { error: i18n('post.form.title_has_sensitive_words', { words: title_sensitive_words.join(',') }) }))
        }
        const text_sensitive_words = ContentUtils.detectSensitiveWords(text)
        if (text_sensitive_words) {
            return res.send(await postEditorView.render(req, { error: i18n('post.form.content_has_sensitive_words', { words: text_sensitive_words.join(',') }) }))
        }

        // 分区检测
        const category = await CategoryDocument.findByUid(category_uid)
        if (!category) {
            return res.send(await postEditorView.render(req, { error: i18n('post.error.category_not_exist') }))
        }

        if (!pid) {
            const params = { category_uid, user_uid: user.uid, text, html, title: title, tags: tags_value, draft: draft_value }
            const e = new UserPreCreatePostEvent(user, params)
            await plugin.emit(e)
            if (e.notCancelled()) {
                const post = await PostDocument.create(params)
                const e = new UserCreatePostEvent(user, category, post)
                await plugin.emit(e)
                return res.redirect(`/p/${post.short_id}`)
            } else {
                return plugin.sendError(req, res, 403, e.reason)
            }
        } else {

            const post = await PostDocument.findByShortId(pid)
            if (!post) {
                return res.send(await postEditorView.render(req, { error: i18n('post.error.post_not_exist') }))
            }


            const params = { text, html, title, tags: tags_value, draft: draft_value }
            const e = new UserPreUpdatePostEvent(user, post, params)
            await plugin.emit(e)
            if (e.notCancelled()) {
                const e = new UserUpdatePostEvent(user, post, params)
                await plugin.emit(e)
                await PostDocument.update(post.uid, { text, html, title, tags: tags_value, draft: draft_value })
                return res.redirect(`/p/${post.short_id}`)
            } else {
                return plugin.sendError(req, res, 403, e.reason)
            }
        }
    })

    app.get('/p/:post_short_id', async (req, res, next) => {
        // 没有使用 plugin.api ，所以这里需要自己捕获异常
        try {
            const user = PassportPlugin.sessions.get(req, 'user')
            const { post_short_id } = req.params
            const page = req.query.p?.toString().trim() || '1'
            if (hasBlankParams(post_short_id)) {
                return plugin.sendError(req, res, 400)
            }

            const post = await PostDocument.findByShortId(post_short_id)
            if (!post) {
                return plugin.sendError(req, res, 404, i18n('post.error.post_not_exist'))
            }
            if (post.deleted) {
                return null
            }
            if (post.draft && (!user || user.uid !== post.user_uid)) {
                return plugin.sendError(req, res, 404, i18n('post.error.post_not_exist'))
            }

            const category = await CategoryDocument.findByUid(post.category_uid)
            if (!category) {
                return plugin.sendError(req, res, 404)
            }

            const author = await UserDocument.findOne({ uid: post.user_uid })
            if (!author) {
                return plugin.sendError(req, res, 404)
            }

            const page_value = parseInt(page)
            const comments_count = await CommentDocument.count(post.uid)
            const comment_docs = await CommentDocument.list(post.uid, page_value, global_config.post.pagination.size)

            const comments = await Promise.all(comment_docs.map(async c => {
                const parent_doc = c.parent_uid ? await CommentDocument.findByUid(c.parent_uid) : undefined
                return {
                    ...c.toJSON(),
                    user: c.user_uid ? await UserDocument.findOne({ uid: c.user_uid }) : undefined,
                    parent: parent_doc ? { ...parent_doc.toJSON(), user: parent_doc.user_uid ? await UserDocument.findOne({ uid: parent_doc.user_uid }) : undefined } : undefined
                }
            }))


            const e = new PostRenderEvent(post, user)
            await plugin.emit(e)
            if (e.isCancelled()) {
                return plugin.sendError(req, res, 403, e.reason)
            }


            res.send(await postView.render(req, {
                category: category.toJSON(), post: {
                    ...post.toJSON(),
                    collected: user ? await UserCollectPostDocument.isCollected(user.uid, post.uid) : undefined,
                    user: author?.toJSON()
                }, comments_count, comments, total_page: Math.ceil(comments_count / global_config.post.pagination.size)
            }))

        } catch (e) {
            plugin.sendError(req, res, 500, e.message)
        }
    })
})

export function sendCommentRedirect(req: Request, res: Response, opts: { comment_short_id?: string, uid?: string }) {
    if (!opts.comment_short_id && !opts.uid) {
        return PostPlugin.sendError(req, res, 400)
    }

    if (opts.comment_short_id) {
        return res.redirect(`/${PostPlugin.id}/comment-redirect?cid=${opts.comment_short_id}`)
    }

    return res.redirect(`/${PostPlugin.id}/comment-redirect?uid=${opts.uid}`)
}
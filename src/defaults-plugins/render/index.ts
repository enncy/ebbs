import { global_config } from "ebbs.config";
import { join, resolve } from "path";
import { definePlugin } from "src/core/plugins";
import { CategoryDocument } from "src/models/category";
import { hasBlankParams } from "src/utils";
import { i18n } from "../i18n";
import fs from 'fs';
import { PassportPlugin, permission } from "../passport";
import dayjs from 'dayjs';
import { UploadedFile } from "express-fileupload";
import sharp from 'sharp';
import { PostDocument, PostModel } from "src/models/post";
import { ContentUtils } from "src/utils/content";
import { CommentDocument } from "src/models/comment";
import { UserDocument } from "src/models/user";
import { CategoryGroupDocument } from "src/models/category_group";


definePlugin({
    id: 'render',
    name: 'render-plugin'
}, (plugin) => {
    const indexView = plugin.definedView('index.ejs', async () => {
        const category_groups = await CategoryGroupDocument.list()
        const category_docs = await CategoryDocument.list()
        return {
            other_categories: category_docs.filter(c => !c.group_uid),
            category_groups: category_groups.map(g => ({ ...g.toJSON(), children: category_docs.filter(c => c.group_uid === g.uid).map(c => c.toJSON()) }))
                .filter(g => g.children.length > 0)
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
            const page = req.query.page?.toString().trim() || '1'
            if (hasBlankParams(id, page)) {
                return
            }
            const cat = await CategoryDocument.findByShortId(id!)
            if (!cat) {
                return
            }
            let page_value = parseInt(page!)
            const size = global_config.category.pagination.size
            if (isNaN(page_value)) {
                return
            }
            page_value = Math.min(Math.max(1, page_value), global_config.category.max_page)
            const post_docs = await PostDocument.list({ category_uid: cat.uid, page: page_value - 1, size: size, })
            const posts = await Promise.all(post_docs.map(async p => {
                const user = await UserDocument.findOne({ uid: p.user_uid })
                return { ...p.toJSON(), user: user?.toJSON() }
            }))
            return await categoryView.render(req, { category: cat, posts })
        }
    })
})



definePlugin({
    id: 'post',
    name: 'post-plugin',
    apis: {
        '/editor': 'post',
        '/upload': 'post'
    },
    sessions: {
        latest_upload_time: Number
    },
}, (plugin, app) => {
    const postEditorView = plugin.definedView('post.editor.ejs', () => {
        return { video_supports: global_config.post.video_supports, upload_file_size_limit: global_config.post.upload_file_size_limit, ...global_config.post.content }
    })

    const postView = plugin.definedView('post.ejs')

    plugin.definePage({
        path: '/editor',
        render: postEditorView.render
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
            const { url } = await addAttachment(user.account, file) || {}
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
            type: 'string', name: 'category_uid', required: true
        },
    }, postEditorView), async (req, res) => {
        const { title, html, text, category_uid, deleted_images = '[]', tags = '', draft = '' } = req.body

        const user = PassportPlugin.sessions.get(req, 'user')!

        // 删除未使用的图片
        const deleted_images_array = JSON.parse(deleted_images)
        if (Array.isArray(deleted_images_array) === false) {
            return res.send(await postEditorView.render(req, { error: i18n('post.form.bad_params') }))
        }
        await Promise.all(deleted_images_array.map(path => {
            return deleteAttachment(path)
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

        const post = await PostDocument.create({ category_uid, user_uid: user.uid, text, html, title: title, tags: tags_value, draft: draft_value })

        res.redirect(`/p/${post.short_id}`)
    })

    app.get('/p/:post_id', async (req, res, next) => {
        // 没有使用 plugin.api ，所以这里需要自己捕获异常
        try {
            const { post_id } = req.params
            const page = req.query.page?.toString().trim() || '1'
            if (hasBlankParams(post_id)) {
                return plugin.sendError(req, res, 400)
            }

            const page_value = parseInt(page)
            const comments_count = await CommentDocument.count(post_id)
            const comment_docs = await CommentDocument.list(post_id, page_value, global_config.post.pagination.size)
            const comments = await Promise.all(comment_docs.map(async c => {
                return {
                    ...c.toJSON(),
                    user: c.user_uid ? await UserDocument.findOne({ uid: c.user_uid }) : undefined
                }
            }))


            const post = await PostDocument.findByShortId(post_id)
            if (!post) {
                return plugin.sendError(req, res, 404)
            }

            const category = await CategoryDocument.findByUid(post.category_uid)
            if (!category) {
                return plugin.sendError(req, res, 404)
            }
            const user = await UserDocument.findOne({ uid: post.user_uid })
            res.send(await postView.render(req, { category: category.toJSON(), post: { ...post.toJSON(), user: user?.toJSON() }, comments_count, comments }))

        } catch (e) {
            plugin.sendError(req, res, 500, e.message)
        }
    })
})



export function addAttachment(account: string, file: UploadedFile) {
    return new Promise<{ url: string, filepath: string }>(async (r, reject) => {
        const date = dayjs().format('YYYY-MM-DD')
        const dir = join(global_config.post.upload.dest_dir, account, date)
        const filepath = join(dir, file.name)
        // 基础路径
        const base = global_config.post.upload.dest_dir.replace(resolve('.'), '').replace(/\\/g, '/')

        if (fs.existsSync(filepath)) {
            return r({
                url: `${base}/${account}/${date}/${file.name}`,
                filepath: filepath
            })
        }

        // 保存文件
        if (fs.existsSync(dir) === false) {
            await fs.promises.mkdir(dir, { recursive: true })
        }

        const { total_count, total_size } = await calculateAllFileSizeAndCount(account)

        // 计算用户文件数量，超过则不允许上传
        if (total_count >= global_config.post.upload.user_max_file_count) {
            return reject(new Error(i18n('post.upload.user_file_count_limit_note', { max: global_config.post.upload.user_max_memorize_use + 'MB' }))
            )
        }

        // 计算用户文件大小，超过则不允许上传 
        if (total_size + file.size > global_config.post.upload.user_max_memorize_use * 1024 * 1024) {
            return reject(new Error(i18n('post.upload.user_memory_limit_note', { max: global_config.post.upload.user_max_memorize_use + 'MB' }))
            )
        }

        // 图片质量规则
        const quality = global_config.post.upload.image_quality_rules.find(rule => {
            return file.size > rule[0] * 1024 * 1024
        })?.[1]


        // 压缩图片
        sharp(file.tempFilePath)
            .on('error', reject)
            .resize({
                width: global_config.post.upload.image_max_width,
                height: global_config.post.upload.image_max_height,
                fit: sharp.fit.inside,
                withoutEnlargement: true,
            })
            .jpeg({ quality: quality || 20 })
            .png({ quality: quality || 20 })
            .toFile(filepath, (err, info) => {
                if (err) {
                    reject(err)
                } else {
                    r({
                        url: `${base}/${account}/${date}/${file.name}`,
                        filepath: filepath
                    })
                }
            })
    });
}

export async function deleteAttachment(filepath: string) {
    if (filepath.startsWith('/')) {
        filepath = filepath.substring(1)
    }
    const file = resolve(filepath)
    if (fs.existsSync(file)) {
        await fs.promises.unlink(file)
    }
}



// 计算所有上传文件的大小 
// 递归计算文件夹大小和数量
export async function calculateAllFileSizeAndCount(account: string): Promise<{ total_size: number, total_count: number }> {
    const dir = join(global_config.post.upload.dest_dir, account)
    if (fs.existsSync(dir) === false) {
        return { total_size: 0, total_count: 0 }
    }

    const files = [dir]
    let total_size = 0;
    let total_count = 0;
    while (files.length > 0) {
        const file = files.shift()
        if (!file) {
            continue
        }
        const stats = await fs.promises
            .stat(file)
            .catch(() => null)
        if (!stats) {
            continue
        }
        if (stats.isFile()) {
            total_size += stats.size
            total_count++
        } else {
            files.push(...await fs.promises.readdir(file))
        }
    }
    return { total_size, total_count }
}


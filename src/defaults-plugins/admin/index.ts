import { definePlugin } from "src/core/plugins";
import { CategoryDocument, CategoryModel } from "src/models/category";
import { CategoryGroupDocument, CategoryGroupModel } from "src/models/category_group";
import { hasBlankParams } from "src/utils";
import { i18n } from "../i18n";
import { UserDocument } from "src/models/user";
import { global_config } from "ebbs.config";
import { PassportPlugin, permission } from "../passport";





definePlugin({
    id: 'admin',
    name: 'admin-plugin',
    apis: {
        '/create-category': 'post',
        '/remove-category': 'get',
        '/update-category': 'post',
        '/create-category-group': 'post',
        '/remove-category-group': 'get',
        '/update-category-group': 'post',
        '/user-manager': 'post',
    },
}, (plugin) => {
    const indexView = plugin.definedView('index.ejs', async (req) => {
        const category_groups = await CategoryGroupDocument.list()
        const category_docs = await CategoryDocument.list()
        return {
            categories: category_docs.map(d => ({ ...d.toJSON(), group_name: d.group_uid ? category_groups.find(g => g.uid === d.group_uid)?.name : '' })),
            category_groups
        }
    })


    const userManagerView = plugin.definedView('user.manager.ejs')

    plugin.definePage({
        path: '/user-manager',
        async render(req, res) {
            const user = PassportPlugin.sessions.get(req, 'user')
            if (!user) {
                return plugin.sendError(req, res, 403)
            }
            if (user.permissions.includes('admin') === false) {
                return plugin.sendError(req, res, 403)
            }

            const size = global_config.user.pagination.size
            const page = req.query.page?.toString() || '1'
            const search = req.query.search?.toString() || ''
            if (hasBlankParams(page)) {
                return plugin.sendError(req, res, 400)
            }
            const page_value = parseInt(page)
            if (isNaN(page_value) || page_value < 1) {
                return plugin.sendError(req, res, 400)
            }
            const filter = Object.create({})
            if (search) {
                filter.$or = [
                    { email: { $regex: search, $options: 'i' } },
                    { account: { $regex: search, $options: 'i' } },
                    { nickname: { $regex: search, $options: 'i' } },
                ]
            }
            return userManagerView.render(req, {
                users: await UserDocument.list(filter, { size, page: page_value }),
                total_count: await UserDocument.count(filter),
            })
        },
    })

    plugin.definePage({
        path: '/index',
        render: (req, res) => {
            const user = PassportPlugin.sessions.get(req, 'user')
            if (!user) {
                return plugin.sendError(req, res, 403)
            }
            if (user.permissions.includes('admin') === false) {
                return plugin.sendError(req, res, 403)
            }


            return indexView.render(req)
        }
    })


    plugin.api('/create-category', permission('admin'), async (req, res, next) => {
        const { name, description, priority } = req.body
        if (hasBlankParams(name, description, priority)) {
            return plugin.sendError(req, res, 400)
        }
        await CategoryDocument.create(name, description, priority)
        res.redirect('/admin/index')
    })

    plugin.api('/remove-category', permission('admin'), async (req, res, next) => {
        const { uid } = req.query
        if (hasBlankParams(uid)) {
            return plugin.sendError(req, res, 400)
        }
        await CategoryDocument.removeByUid(uid!.toString())
        res.redirect('/admin/index')
    })

    plugin.api('/update-category', permission('admin'), async (req, res, next) => {
        const { uid, name, description, priority, icon, add_to_group } = req.body
        if (hasBlankParams(uid, name, description, priority)) {
            return plugin.sendError(req, res, 400)
        }

        let group_uid = undefined
        if (typeof add_to_group === 'string' && add_to_group.trim()) {
            const group = await CategoryGroupModel.findOne({ name: add_to_group.trim() })
            if (group) {
                group_uid = group.uid
            } else {
                return plugin.sendError(req, res, 400, i18n('admin.error.category_group.name_not_exist'))
            }
        }

        if (typeof icon !== 'string') {
            return plugin.sendError(req, res, 400)
        }
        if (icon.trim() !== '' && icon.startsWith('http') === false) {
            return plugin.sendError(req, res, 400, i18n('admin.error.category.invalid_icon_link'))
        }

        await CategoryModel.updateOne({ uid }, { name, description, priority, group_uid, icon: icon ? icon : undefined })
        res.redirect('/admin/index')
    })

    // 分组

    plugin.api('/create-category-group', permission('admin'), async (req, res, next) => {
        const { group_name, group_priority } = req.body
        if (hasBlankParams(group_name, group_priority)) {
            return plugin.sendError(req, group_priority, 400)
        }
        await CategoryGroupDocument.create(group_name, group_priority)
        res.redirect('/admin/index')
    })

    plugin.api('/remove-category-group', permission('admin'), async (req, res, next) => {
        const { group_uid } = req.query
        if (hasBlankParams(group_uid)) {
            return plugin.sendError(req, res, 400)
        }
        await CategoryGroupDocument.removeByUid(group_uid!.toString())
        res.redirect('/admin/index')
    })

    plugin.api('/update-category-group', permission('admin'), async (req, res, next) => {
        const { group_uid, group_name, group_priority } = req.body
        if (hasBlankParams(group_uid, group_name, group_priority)) {
            return plugin.sendError(req, res, 400)
        }
        await CategoryGroupModel.updateOne({ uid: group_uid }, { name: group_name, priority: group_priority })
        res.redirect('/admin/index')
    })




    // 用户操作
    plugin.api('/user-manager', permission('admin'), async (req, res) => {
        const { action, uid, permissions } = req.body
        if (hasBlankParams(action, uid)) {
            return plugin.sendError(req, res, 400)
        }
        const user = await UserDocument.findOne({ uid })
        if (!user) {
            return plugin.sendError(req, res, 404)
        }

        switch (action) {
            case 'ban':
                await UserDocument.ban(uid)
                break
            case 'unban':
                await UserDocument.unban(uid)
                break
            case 'remove':
                await UserDocument.remove(uid)
                break
            case 'recover':
                await UserDocument.recover(uid)
                break
            case 'permission':
                await UserDocument.permissions(uid, String(permissions).split('\n').map(s => s.trim()).filter(Boolean))
                break
            default:
                return plugin.sendError(req, res, 400)
        }

        res.redirect(req.url)
    })
})




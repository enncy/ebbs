import { definePlugin } from "src/core/plugins";
import { CategoryDocument, CategoryModel } from "src/models/category";
import { CategoryGroupDocument, CategoryGroupModel } from "src/models/category_group";
import { hasBlankParams } from "src/utils";
import { i18n } from "../i18n";





definePlugin({
    id: 'admin',
    name: 'admin-plugin',
    apis: {
        '/create-category': 'post',
        '/remove-category': 'get',
        '/update-category': 'post',
        '/create-category-group': 'post',
        '/remove-category-group': 'get',
        '/update-category-group': 'post'
    },
}, (plugin) => {
    const indexView = plugin.definedView('index.ejs', async () => {
        const category_groups = await CategoryGroupDocument.list()
        const category_docs = await CategoryDocument.list()
        return {
            categories: category_docs.map(d => ({ ...d.toJSON(), group_name: d.group_uid ? category_groups.find(g => g.uid === d.group_uid)?.name : '' })),
            category_groups
        }
    })

    plugin.definePage({
        path: '/index',
        render: indexView.render
    })


    plugin.api('/create-category', async (req, res, next) => {
        const { name, description, priority } = req.body
        if (hasBlankParams(name, description, priority)) {
            return plugin.sendError(req, res, 400)
        }
        await CategoryDocument.create(name, description, priority)
        res.redirect('/admin/index')
    })
    plugin.api('/remove-category', async (req, res, next) => {
        const { uid } = req.query
        if (hasBlankParams(uid)) {
            return plugin.sendError(req, res, 400)
        }
        await CategoryDocument.removeByUid(uid!.toString())
        res.redirect('/admin/index')
    })
    plugin.api('/update-category', async (req, res, next) => {
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
        if (icon.trim() === '' || icon.startsWith('http') === false) {
            return plugin.sendError(req, res, 400, i18n('admin.error.category.invalid_icon_link'))
        }

        await CategoryModel.updateOne({ uid }, { name, description, priority, group_uid, icon: icon ? icon : undefined })
        res.redirect('/admin/index')
    })

    // 分组

    plugin.api('/create-category-group', async (req, res, next) => {
        const { group_name, group_priority } = req.body
        if (hasBlankParams(group_name, group_priority)) {
            return plugin.sendError(req, group_priority, 400)
        }
        await CategoryGroupDocument.create(group_name, group_priority)
        res.redirect('/admin/index')
    })
    plugin.api('/remove-category-group', async (req, res, next) => {
        const { group_uid } = req.query
        if (hasBlankParams(group_uid)) {
            return plugin.sendError(req, res, 400)
        }
        await CategoryGroupDocument.removeByUid(group_uid!.toString())
        res.redirect('/admin/index')
    })
    plugin.api('/update-category-group', async (req, res, next) => {
        const { group_uid, group_name, group_priority } = req.body
        if (hasBlankParams(group_uid, group_name, group_priority)) {
            return plugin.sendError(req, res, 400)
        }
        await CategoryGroupModel.updateOne({ uid: group_uid }, { name: group_name, priority: group_priority })
        res.redirect('/admin/index')
    })
})




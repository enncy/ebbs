import { definePlugin } from "src/core/plugins";
import { CategoryDocument, CategoryModel } from "src/models/category";
import { hasBlankParams } from "src/utils";





definePlugin({
    id: 'admin',
    name: 'admin-plugin',
    apis: {
        '/create-category': 'post',
        '/remove-category': 'get',
        '/update-category': 'post'
    },
}, (plugin) => {
    const indexView = plugin.definedView('index.ejs', async () => {
        return {
            categories: await CategoryDocument.list()
        }
    })

    plugin.definePage({
        path: '/index',
        render: indexView.render
    })


    plugin.api('/create-category', async (req, res, next) => {
        const { name, description, priority } = req.body
        if (hasBlankParams(name, description, priority)) {
            res.status(400)
            next()
            return
        }
        await CategoryDocument.create(name, description, priority)
        res.redirect('/admin/index')
    })

    plugin.api('/remove-category', async (req, res, next) => {
        const { uid } = req.query
        if (hasBlankParams(uid)) {
            res.status(400)
            next()
            return
        }
        await CategoryDocument.removeByUid(uid!.toString())
        res.redirect('/admin/index')
    })

    plugin.api('/update-category', async (req, res, next) => {
        const { uid, name, description, priority } = req.body
        if (hasBlankParams(uid, name, description, priority)) {
            res.status(400)
            next()
            return
        }

        await CategoryModel.updateOne({ uid }, { name, description, priority })
        res.redirect('/admin/index')
    })
})




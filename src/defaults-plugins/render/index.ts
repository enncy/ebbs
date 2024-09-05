import { definePlugin } from "src/core/plugins";
import { CategoryDocument } from "src/models/category";
import { hasBlankParams } from "src/utils";



definePlugin({
    id: 'render',
    name: 'render-plugin'
}, (plugin, app) => {
    const indexView = plugin.definedView('index.ejs', async () => {
        return {
            categories: await CategoryDocument.list()
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
            const id = req.query.id?.toString()
            if (hasBlankParams(id)) {
                return
            }
            const cat = await CategoryDocument.findByShortId(id!)
            if (!cat) {
                return
            }
            return await categoryView.render(req, { category: cat })
        }
    })
})



definePlugin({
    id: 'post',
    name: 'post-plugin',
    apis: {
        '/post': 'post'
    }
}, (plugin, app) => {
    const postEditorView = plugin.definedView('post.editor.ejs')
    const postView = plugin.definedView('post.ejs')
 
    plugin.definePage({
        path: '/editor',
        render: postEditorView.render
    })

    plugin.api('/post', (req, res) => {
        console.log(req.body);
        res.send('hello')
    })


    // app.get('/post/:post_id', (req, res) => {
    //     console.log(req.params);
    //     console.log(req.query);
    //     res.send('hello')
    // })
})











import { definePlugin } from "src/core/plugins";
import { UserDocument } from "src/models/user";




definePlugin({
    id: 'user',
    name: 'user-plugin',
}, (plugin, app) => {

    const userView = plugin.definedView('index.ejs')


    app.get('/u/:account', async (req, res) => {
        const account = req.params.account?.trim() || ''
        if (!account) {
            return plugin.sendError(req, res, 400)
        }
        const find_account = await UserDocument.findOne({ account })
        if (!find_account) {
            return plugin.sendError(req, res, 404)
        }
        return res.send(await userView.render(req, { account: find_account }))
    })

})
import { definePlugin } from "src/core/plugins";



definePlugin({
    id: 'render',
    name: 'render-plugin',
}, (plugin) => {
    const indexView = plugin.definedView('index.ejs')
    plugin.definePage({
        path: '/',
        custom_path: true,
        render: indexView.render
    })
})















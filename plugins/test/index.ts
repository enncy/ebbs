import { definePlugin } from "ebbs"



definePlugin({
    id: 'test',
    name: 'test-plugin',
    version: '1.0.0',
    description: 'test plugin'
}, (plugin) => {
    plugin.definePage({
        path: '/test',
        render: (req) => {
            return 'Hello World'
        }
    })
})


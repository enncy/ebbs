
import express from 'express';
import session from 'express-session';
import path from 'path';
import { mongo } from './mongo';
import ConnectMongo from 'connect-mongo';
import config from '../ebbs.config.json'
import PluginRender from './middleware/plugin-render';
import { loadPlugins } from './core/plugins';
import dotenv from 'dotenv'; 

dotenv.config()

    ; (async () => {
        const app = express(); 
        // 连接数据库
        await mongo(config.db.mongo_url.trim());
        app
            // 静态资源
            .use("/public", express.static(path.resolve('public')))
            // 启用 session
            .use(
                session({
                    name: 'mclds-admin-session',
                    secret: config.db.mongo_session_secret.trim(), // 用来对session id相关的cookie进行签名
                    store: ConnectMongo.create({ mongoUrl: config.db.mongo_session_url.trim() }), // 本地存储session（文本文件，也可以选择其他store，比如redis的）
                    saveUninitialized: false, // 是否自动保存未初始化的会话，建议false
                    resave: false, // 是否每次都重新保存会话，建议false
                    cookie: {
                        maxAge: config.db.mongo_session_valid_day * 24 * 60 * 60 * 1000 // 有效期一个月，单位是毫秒
                    }
                })
            )
            // 解析 post 数据
            .use(express.urlencoded({ extended: false, limit: config.post.size_limit }))
            .use(express.json({ limit: config.post.size_limit }))

        // 加载插件
        const { plugins, context } = await loadPlugins()
        // 检测同ID的插件
        const ids = plugins.map((plugin) => plugin.id)
        const set = new Set()
        for (const id of ids) {
            if (set.has(id)) {
                console.error(`[plugin] error: duplicate plugin id: ${id}`)
                process.exit(1)
            }
            set.add(id)
        }

        // 调用插件的 onload 方法
        for (const plugin of plugins) {
            try {
                plugin.app = app
                plugin.onload(plugin, app);
            } catch (e) {
                console.error('[plugin] error when load: ' + plugin.name);
                console.error(e);
            }
        }

        // 渲染插件定义的页面
        app.use(PluginRender(context.getAllPages()))

        // app.post('/set-plugin-settings', (req, res) => {
        //     const { id, settings } = req.body;
        //     const plugin = plugins.find((plugin) => plugin.id === id);
        //     if (!plugin) {
        //         res.json({ code: 1, message: 'plugin not found' });
        //         return;
        //     }
        //     // 只更新已定义的设置字段
        //     const plugin_settings = plugin.config.settings || {}
        //     for (const key in plugin_settings) {
        //         if (Object.prototype.hasOwnProperty.call(settings, key)) {
        //             const val = settings[key];
        //             plugin.settings.set(key, val);
        //         }
        //     }
        //     res.json({ code: 0, message: 'success' });
        // })

        // 启动服务器
        app.listen(config.port, () => {
            console.log('[express] server launched as http://localhost:' + config.port);
        });
    })();

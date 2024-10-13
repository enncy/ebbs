
import express from 'express';
import session from 'express-session';
import path, { resolve } from 'path';
import { mongo } from './mongo';
import ConnectMongo from 'connect-mongo';
import PluginRender from './middleware/plugin-render';
import { loadPlugins } from './core/plugins';
import dotenv from 'dotenv';
import winston from 'winston';
import chalk from 'chalk';
import { errorPages } from './middleware/error-pages';
import fileupload from 'express-fileupload';
import { global_config } from 'ebbs.config';

dotenv.config();

; (async () => {
    const app = express();
    // 连接数据库
    await mongo(global_config.db.mongo_url.trim());
    app
        // 静态资源 
        .use("/assets", express.static(path.resolve('assets')))
        .use("/public/assets", express.static(path.resolve('public/assets')))
        .use("/public/uploads", express.static(path.resolve('public/uploads')))
        // 文件上传
        .use(fileupload({
            useTempFiles: true,
            tempFileDir: global_config.post.upload.tmp_dir,
            abortOnLimit: true,
            defCharset: 'utf-8',
            defParamCharset: 'utf-8',
            limits: {
                fileSize: global_config.post.upload_file_size_limit * 1024 * 1024,
            }
        }))
        // 启用 session
        .use(
            session({
                name: 'mclds-admin-session',
                secret: global_config.db.mongo_session_secret.trim(), // 用来对session id相关的cookie进行签名
                store: ConnectMongo.create({ mongoUrl: global_config.db.mongo_session_url.trim() }), // 本地存储session（文本文件，也可以选择其他store，比如redis的）
                saveUninitialized: false, // 是否自动保存未初始化的会话，建议false
                resave: false, // 是否每次都重新保存会话，建议false
                cookie: {
                    maxAge: global_config.db.mongo_session_valid_day * 24 * 60 * 60 * 1000 // 有效期一个月，单位是毫秒
                }
            })
        )
        // 解析 post 数据
        .use(express.urlencoded({ extended: false, limit: '2mb' }))
        .use(express.json({ limit: '2mb' }))

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

    app
        // 渲染插件定义的页面
        .use(PluginRender(context.getAllPages()))
        // 错误页面
        .use(errorPages(context))


    // 启动服务器
    app.listen(global_config.port, () => {
        console.log('[express] server launched as http://localhost:' + global_config.port);
    });
})();


// 代理日志
export const logger = winston.createLogger({
    format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.simple()),
    transports: [
        new winston.transports.File({ filename: resolve('logs/console.log'), lazy: true }),
        new winston.transports.File({ filename: resolve('logs/error.log'), level: 'error', lazy: true }),
    ]
})


process.on('uncaughtException', (err) => {
    console.error(chalk.redBright(err.message));
    logger.error(err.message);
    logger.error(err.stack);
})

process.on('unhandledRejection', (reason, promise) => {
    promise.catch((err) => {
        console.error(err);
        logger.error(err.message);
        logger.error(err.stack);
    })
})
import { resolve } from "path";

export const global_config = {
    url: 'http://localhost:3666',
    port: 3666,
    db: {
        mongo_url: 'mongodb://127.0.0.1:27017/ebbs',
        mongo_session_url: 'mongodb://127.0.0.1:27017/ebbs-session',
        mongo_session_secret: '963a04cf-27fc-43b1-95c6-36db40e1519b',
        mongo_session_valid_day: 30
    },
    language: 'default',
    content: {
        // 敏感词检测文件
        sensitive_worlds_files: [
            resolve('public/sensitive_words/words.txt')
        ],
        // 搜索分词过滤
        segment_custom_words: [
            resolve('public/segment/custom_dict.txt')
        ],
        // 搜索分词过滤
        segment_ignore_words: [
            resolve('public/segment/ignore_dict.txt')
        ],
    },
    category: {
        max_page: 99,
        pagination: {
            size: 10
        }
    },
    post: {
        pagination: {
            size: 10
        },
        // 文本检测
        content: {
            content_min_length: 10,
            content_max_length: 10000,
            title_min_length: 5,
            title_max_length: 100,
            tags_max_length: 5,
        },
        /**
         * 上传的文件大小最高：10MB
         * 一般用于图片上传
         */
        upload_file_size_limit: 10,
        upload: {
            tmp_dir: resolve('public/.tmp'),
            dest_dir: resolve('public/uploads'),
            // 上传频率，3秒内只能上传一次
            period: 3,
            // 每个用户最大存储空间：100MB
            user_max_memorize_use: 100,
            // 每个用户最大文件数量：1000
            user_max_file_count: 1000,
            // 图片最大宽度
            image_max_width: 1920,
            // 图片最大高度
            image_max_height: 1080,
            // 图片质量规则，注意顺序必须是从大到小，默认的值测试后效果相对合适，请勿随意修改
            image_quality_rules: [
                // 大于 5MB 的图片压缩质量 40%
                [5, 40],
                // 大于 1MB 的图片压缩质量 60%
                [1, 60],
                // 默认压缩质量 60%
                [0, 80]
            ],
        },
        /**
         * domain: 视频地址的域名
         * name: 视频平台名称
         * iframe_template: 视频地址转换为 iframe 的模板
         *      {{url}} : 视频地址
         *      {{path[xxxx]}} : 视频地址的路径，xxxx 为每个 / 路径分割的索引
         *      {{params.xxxx}} : 视频地址的参数，xxxx 为参数名，例如：{{params.v}} 为 https://www.youtube.com/watch?v=xxxx 中的 v 参数
         */
        video_supports: [
            {
                domain: 'bilibili.com',
                name: '哔哩哔哩',
                iframe_template: `<iframe width="450" height="250" src="https://player.bilibili.com/player.html?bvid={{path[1]}}&as_wide=1" frameborder="0" allowfullscreen=""></iframe>`
            },
            {
                domain: 'youtube.com',
                name: 'YouTube',
                iframe_template: `<iframe width="450" height="250" src="https://www.youtube.com/embed/{{params.v}}" frameborder="0"></iframe>`
            }
        ]
    }
};

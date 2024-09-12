import { global_config } from "ebbs.config"
import fs from 'fs';
import jieba from '@node-rs/jieba';



export class ContentUtils {
    // 分词忽略词
    private static segment_ignore_words: Set<string> = new Set()
    // 敏感词
    private static sensitive_worlds: Set<string> = new Set()

    constructor() {
        // 加载内置分词词典
        jieba.load()

        for (const file of global_config.content.sensitive_worlds_files) {
            const buffer = fs.readFileSync(file)
            // 加载特殊敏感词到词库
            ContentUtils.loadCustomSegmentDict(buffer)
            // 加载敏感词到检测库
            ContentUtils.loadSensitiveWords(buffer)
        }

        // 加载自定义词库
        for (const file of global_config.content.segment_custom_words) {
            ContentUtils.loadCustomSegmentDict(fs.readFileSync(file))
        }
        // 加载忽略词库
        for (const file of global_config.content.segment_ignore_words) {
            ContentUtils.loadIgnoreSegmentDict(fs.readFileSync(file))
        }
    }

    /**
     *  加载分词词典
     */
    public static loadCustomSegmentDict(buffer: Buffer) {
        jieba.loadDict(buffer)
    }

    /**
     *  加载忽略词词典
     */
    public static loadIgnoreSegmentDict(buffer: Buffer) {
        for (const word of ContentUtils.splitTxtContent(buffer.toString('utf8'))) {
            ContentUtils.segment_ignore_words.add(word)
        }
    }

    /**
     *  加载敏感词词典
     */
    public static loadSensitiveWords(buffer: Buffer) {
        for (const word of ContentUtils.splitTxtContent(buffer.toString('utf8'))) {
            ContentUtils.sensitive_worlds.add(word)
        }
    }

    private static splitTxtContent(content: any) {
        if (typeof content !== 'string') {
            return []
        }
        return String(content).split('\n').map(world => world.trim()).filter(world => !!world)
    }

    /**
     * 敏感词检测
     * @param content 文本，如果是字符串则先分词再检测
     * @returns 包含的敏感词
     */
    public static detectSensitiveWords(content: string | string[]): string[] | undefined {
        const words = Array.isArray(content) ? content : jieba.extract(content, content.length).map(k => k.keyword)
        const detect_sensitive_worlds: string[] = []
        for (const word of words) {
            if (ContentUtils.sensitive_worlds.has(word)) {
                detect_sensitive_worlds.push(word)
            }
        }
        return detect_sensitive_worlds.length ? detect_sensitive_worlds : undefined
    }

    /**
     * 分词
     * @param str 字符串
     * @param max_num 分词数量 
     */
    public static cutForSearch(str: string, max_num: number = 99) {
        let keys = jieba.cutForSearch(str, true);
        if (keys.length === 0) {
            let worlds = jieba
                .cutForSearch(str, true)
                .filter((w) => /[\u4e00-\u9fa5a-zA-Z0-9]/.test(w) === true)
                .filter((w) => w.length > 1);
            return worlds.length === 0 ? [str] : worlds;
        }

        // 排除忽略词
        keys = keys.filter((k) => !ContentUtils.segment_ignore_words.has(k));

        return keys.slice(0, max_num);
    }
}

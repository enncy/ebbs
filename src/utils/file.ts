import { global_config } from "ebbs.config";
import { UploadedFile } from "express-fileupload";
import { join, resolve } from "path";
import fs from 'fs';
import { i18n } from "src/defaults-plugins/i18n";
import sharp from 'sharp';
import { UserDocument } from "src/models/user";

export class UserAttachment {
    public constructor(public user: UserDocument, public folder: string) { }


    static of(user: UserDocument, folder: string) {
        return new UserAttachment(user, folder)
    }

    getFolder() {
        return join(global_config.post.upload.dest_dir, this.user.account, this.folder)
    }

    getRootFolder() {
        return join(global_config.post.upload.dest_dir, this.user.account)
    }

    getRelativePath(filename: string) {
        // 基础路径
        const base = global_config.post.upload.dest_dir.replace(resolve('.'), '').replace(/\\/g, '/')
        return join(base, this.user.account, this.folder, filename)
    }

    addImage(file: UploadedFile, options: { overwrite: boolean } = { overwrite: false }) {
        return new Promise<{ url: string, filepath: string }>(async (r, reject) => {
            const dir = this.getFolder()
            const filepath = join(dir, file.name)

            if (options.overwrite === false) {
                try {
                    const result = await this.requireFile(file)
                    if (result) {
                        return r(result)
                    }
                } catch (e) {
                    return reject(e)
                }
            } else {
                // 保存文件
                if (fs.existsSync(dir) === false) {
                    await fs.promises.mkdir(dir, { recursive: true })
                }
            }


            // 图片质量规则
            const quality = global_config.post.upload.image_quality_rules.find(rule => {
                return file.size > rule[0] * 1024 * 1024
            })?.[1]


            // 压缩图片
            sharp(file.tempFilePath)
                .on('error', reject)
                .resize({
                    width: global_config.post.upload.image_max_width,
                    height: global_config.post.upload.image_max_height,
                    fit: sharp.fit.inside,
                    withoutEnlargement: true,
                })
                .jpeg({ quality: quality || 20 })
                .png({ quality: quality || 20 })
                .toFile(filepath, (err, info) => {
                    if (err) {
                        reject(err)
                    } else {
                        r({
                            url: this.getRelativePath(file.name),
                            filepath: filepath
                        })
                    }
                })
        });
    }


    async requireFile(file: UploadedFile) {
        const dir = this.getFolder()
        const filepath = join(dir, file.name)

        // 如果文件已经存在，则直接返回
        if (fs.existsSync(filepath)) {
            return {
                url: this.getRelativePath(file.name),
                filepath: filepath
            }
        }

        // 保存文件
        if (fs.existsSync(dir) === false) {
            await fs.promises.mkdir(dir, { recursive: true })
        }

        const { total_count, total_size } = await calculateAllFileSizeAndCount(this.getRootFolder())

        // 计算用户文件数量，超过则不允许上传
        if (total_count >= global_config.post.upload.user_max_file_count) {
            throw new Error(i18n('post.upload.user_file_count_limit_note', { max: global_config.post.upload.user_max_memorize_use + 'MB' }))
        }

        // 计算用户文件大小，超过则不允许上传 
        if (total_size + file.size > global_config.post.upload.user_max_memorize_use * 1024 * 1024) {
            throw new Error(i18n('post.upload.user_memory_limit_note', { max: global_config.post.upload.user_max_memorize_use + 'MB' }))
        }
    }

    public async delete(filename: string) {
        const file = join(global_config.post.upload.dest_dir, this.folder, filename)
        if (fs.existsSync(file)) {
            await fs.promises.unlink(file)
        }
    }

    public static async deleteAttachment(filepath: string) {
        if (filepath.startsWith('/')) {
            filepath = filepath.substring(1)
        }
        const file = resolve(filepath)
        if (fs.existsSync(file)) {
            await fs.promises.unlink(file)
        }
    }
}




// 计算所有上传文件的大小 
// 递归计算文件夹大小和数量
export async function calculateAllFileSizeAndCount(dir: string): Promise<{ total_size: number, total_count: number }> {
    if (fs.existsSync(dir) === false) {
        return { total_size: 0, total_count: 0 }
    }

    const files = [dir]
    let total_size = 0;
    let total_count = 0;
    while (files.length > 0) {
        const file = files.shift()
        if (!file) {
            continue
        }
        const stats = await fs.promises
            .stat(file)
            .catch(() => null)
        if (!stats) {
            continue
        }
        if (stats.isFile()) {
            total_size += stats.size
            total_count++
        } else {
            files.push(...await fs.promises.readdir(file))
        }
    }
    return { total_size, total_count }
}

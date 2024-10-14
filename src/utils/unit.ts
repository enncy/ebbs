import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime"
import 'dayjs/locale/zh-cn'
dayjs.extend(relativeTime)

export const unit = {
    /**
     * 根据指定的t，获取t距离现在过去了多少天 
     */
    timeFrom(t: number) {
        if(t <= 0){
            return '刚刚'
        }
        return dayjs(t).locale('zh-cn').fromNow();
    },
    /**
     * 计数单位
     */
    count(num: number) {
        if (num === 0) return '0'

        const mapping = [
            ['b', Math.pow(10, 6)],
            ['m', Math.pow(10, 6)],
            ['k', Math.pow(10, 3)],
            ['', 1]
        ] as [string, number][];
        const index = mapping.map((i) => Math.floor(num / i[1])).findIndex((i) => i > 0);
        return (num / mapping[index][1]).toFixed(0) + mapping[index][0];
    },
    /**
     * 文件大小单位
     * @param num 
     * @returns 
     */
    fileSize(num: number) {
        if (num === 0) return '0'

        const mapping = [
            ['T', Math.pow(1024, 4)],
            ['G', Math.pow(1024, 3)],
            ['MB', Math.pow(1024, 2)],
            ['KB', Math.pow(1024, 1)],
            ['B', 1]
        ] as [string, number][];

        const index = mapping.map((i) => Math.floor(num / i[1])).findIndex((i) => i > 0);

        return (num / mapping[index][1]).toFixed(2) + ' ' + mapping[index][0];
    }
}
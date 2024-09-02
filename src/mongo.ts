import mongoose from 'mongoose';

// 连接数据库
export function mongo(url: string) {
	return new Promise((resolve, reject) => {
		mongoose.set('strictQuery', false);
		mongoose.set('bufferTimeoutMS', 60 * 1000);
		// // 设置最大查询时间
		mongoose.set('maxTimeMS', 60 * 1000);

		const prom = mongoose
			.connect(url)
			.then((mongo) => {
				console.log('[mongo] server launched : ' + url);
			})
			.catch((err) => console.error('[mongo] launch error : ' + err.message));

		resolve(prom);

		mongoose.connection.on('error', (err) => {
			console.error('[mongo] server error : ' + err.message);
		});
	});
}

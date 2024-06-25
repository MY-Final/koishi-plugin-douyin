import { Context, Schema, h, segment } from 'koishi'
import { resolve } from 'path'
import {} from '@koishijs/plugin-console'

export const name = 'xiaohongshu'

export interface Config {
  apikey: string;
}

export const Config = Schema.object({
  description: Schema.string().default('api参考, 可按量购买').description('https://shorturl.at/2rATh'),
  apikey: Schema.string().default('').required().description('填写douyin解析的apikey'),
})

export const api = 'https://api.mu-jie.cc/douyin'

export function apply(ctx: Context, config: Config) {

  async function fetchFromAPI(url) {
    return await ctx.http.get(`${api}?url=${url}&key=${config.apikey}`);
  };

  ctx.middleware(async (session, next) => {
    if (!session.content.includes('douyin.com')) return next()
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const url = session.content.match(urlRegex)[0];
    if (!url) return

    try {
      const result = await fetchFromAPI(url);
      if (result.code !== 200) {
        return '解析失败!';
      }
      const type = result.data.type
      const cover = result.data.cover || '';

      if (type === "视频") {
        session.send(h.video(result.data.url))
      }
    } catch(err) {
      console.log(err);
      return `发生错误!;  ${err}`;
    }
  });

  ctx.inject(['console'], (ctx) => {
    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })
  })
}

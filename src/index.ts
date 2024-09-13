import { Context, Schema, h, segment } from 'koishi'
import { resolve } from 'path'
import {} from '@koishijs/plugin-console'

export const name = 'douyin'

export interface Config {
  host: string,
  key: string
}

export const Config = Schema.object({
  host: Schema.string().default('douyin-media-downloader.p.rapidapi.com').description('不需要做任何改动'),
  key: Schema.string().default('').description('填写从rapidapi获取的key'),
  description: Schema.string().default('api主页：https://rapidapi.com/FarhanAliOfficial/api/douyin-media-downloader').description(''),
})

export function apply(ctx: Context, config: Config) {

  async function getVideoDetail(url: string) {
    const headers = {
      'X-RapidAPI-Key': config.key,
      'X-RapidAPI-Host': config.host
    };
    return await ctx.http.get('https://' + config.host + '/?url=' + url, { headers });
  }

  ctx.middleware(async (session, next) => {
    if (!session.content.includes('douyin.com')) return next()
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const url = session.content.match(urlRegex)[0];
    if (!url) return

    try {
      const result = await getVideoDetail(url);
      if (result.status !== 'success') {
        return '解析失败!';
      }
      const {
        data: {
          thumbnail,
          download_links
        },
      } = result;

      const HDVideoUrl = download_links.find(item => item.label === "Download MP4 HD")?.url;
      if (HDVideoUrl) {
        const videoBuffer = await ctx.http.get<ArrayBuffer>(HDVideoUrl, {
          responseType: 'arraybuffer',
        });
        session.send(h.video(videoBuffer, 'video/mp4'))
      } else {
        session.send('没找到可下载的视频！')
        setTimeout(() => {
          session.send(h.image(thumbnail))
        }, 500)
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

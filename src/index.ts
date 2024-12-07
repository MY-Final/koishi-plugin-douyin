import { Context, Schema, h, segment } from 'koishi'
import { resolve } from 'path'
import {} from '@koishijs/plugin-console'

export const name = 'douyin'

export interface Config {
  apiHost: string
}

export const Config = Schema.object({
  apiHost: Schema.string().default('http://192.168.2.167:16252').description('填写你的API前缀'),
  description: Schema.string().default('考虑到解析速度+请求次数, 更换解析API为[Douyin_TikTok_Download_API], 部署参考地址：https://github.com/Evil0ctal/Douyin_TikTok_Download_API/blob/main/README.md').description(''),
})

export function apply(ctx: Context, config: Config) {

  async function getVideoDetailMinimal(url: string) {
    return await ctx.http.get(config.apiHost + '/api/hybrid/video_data?url=' + url + '&minimal=true');
  };

  ctx.middleware(async (session, next) => {
    if (!session.content.includes('douyin.com')) return next()
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const url = session.content.match(urlRegex)[0];
    if (!url) return

    try {
      const response = await getVideoDetailMinimal(url);
      if (response.code !== 200) {
        return '解析失败! 该链接或许不支持';
      }
      const {
        data: {
          desc,
          image_data,
          music
        }
      } = response;

      const isTypeImage = image_data && Object.keys(image_data).length > 0;
      session.send('抖音解析内容：\n' + desc);
      if (isTypeImage) {
        // 下载图片
        const {
          no_watermark_image_list
        } = image_data;
        no_watermark_image_list.forEach(async item => {
          await session.send(h('img', { src: item }))
        });
      } else {
        // 下载视频
        const videoDuration = music && music.video_duration
        if (videoDuration > 60) {
          // 发送预览图
          const {
            data: {
              cover_data: coverData
            }
          } = response;
          await session.send('视频过长~ 请打开抖音客户端查看');
          await session.send(h('img', { src: coverData?.dynamic_cover?.url_list[0] }))
        } else {
          const videoBuffer = await ctx.http.get<ArrayBuffer>(config.apiHost + '/api/download?url=' + url + '&prefix=true&with_watermark=true', {
            responseType: 'arraybuffer',
          });
          session.send(h.video(videoBuffer, 'video/mp4'))
        }
      }
    } catch(err) {
      console.log(err);
      return `发生错误! 请重试; ${err}`;
    }
  });

  ctx.inject(['console'], (ctx) => {
    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })
  })
}

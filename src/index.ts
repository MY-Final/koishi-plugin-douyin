import { Context, Schema, h, segment } from 'koishi'

export const name = 'douyin'

export const usage = `
## 解析群聊中抖音链接

考虑到解析速度+请求次数, 更换解析API为"Douyin_TikTok_Download_API"

参考地址：https://github.com/Evil0ctal/Douyin_TikTok_Download_API/blob/main/README.md'

### 使用方法

请在app中复制链接, 然后发送到群聊中即可解析，支持如下链接:

<pre>
2.89 复制打开抖音，看看【海报新闻的作品】对话一夜涨粉8万的00后脑瘫主播“汤米”：自己手抖...
https://v.douyin.com/i5cseJ9a/ 10/23 r@E.uF nQX:/
</pre>
`;

export interface Config {
  apiHost: string,
  maxDuration: string
}

export const Config = Schema.object({
  apiHost: Schema.string().default('http://192.168.2.167:16252').description('填写你的API前缀'),
  maxDuration: Schema.string().default('90').description('允许下载的最大视频长度(秒)，否则仅发送预览图，避免bot卡住'),
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
      await session.send('抖音解析：\n' + desc);
      if (isTypeImage) {
        // 下载图片
        const {
          no_watermark_image_list
        } = image_data;
        if (no_watermark_image_list.length > 3) {
          const forwardMessages = await Promise.all(no_watermark_image_list.map(async (item) => {
            return h('img', { src: item })
          }));
          const forwardMessage = h('message', { forward: true, children: forwardMessages });
          await session.send(forwardMessage);
        } else {
          no_watermark_image_list.forEach(async item => {
            await session.send(h('img', { src: item }))
          });
        }
      } else {
        // 下载视频
        const videoDuration = music && music.duration
        if (videoDuration > config.maxDuration) {
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
}

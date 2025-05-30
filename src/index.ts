import { Context, Schema, h, segment, Logger } from 'koishi'

export const name = 'douyin-myfinal'

// 创建插件专用的日志记录器
const logger = new Logger('douyin-myfinal')

export const usage = `
## 抖音链接解析插件

> 原插件作者: [tediorelee](https://github.com/tediorelee)
>
> 版本: 添加了自定义回复模板、日志

考虑到解析速度+请求次数, 使用"Douyin_TikTok_Download_API"作为解析API

参考地址：https://github.com/Evil0ctal/Douyin_TikTok_Download_API/blob/main/README.md'

### 使用方法

请在app中复制链接, 然后发送到群聊中即可解析，支持如下链接:

<pre>
2.89 复制打开抖音，看看【海报新闻的作品】对话一夜涨粉8万的00后脑瘫主播"汤米"：自己手抖...
https://v.douyin.com/i5cseJ9a/ 10/23 r@E.uF nQX:/
</pre>

### 功能特性

- 自动解析群聊中的抖音链接
- 支持图片和视频内容
- 自定义回复模板
- 完整的日志记录
- 视频时长限制，避免下载过大视频

### 自定义回复模板

在回复模板中可以使用以下变量：
- {desc}: 视频描述
- {nickname}: 作者昵称
- {type}: 内容类型（图片/视频）
- {digg_count}: 点赞数
- {comment_count}: 评论数
- {share_count}: 分享数
- {collect_count}: 收藏数
- {duration}: 视频时长(秒)
- {signature}: 作者签名
`;

export interface Config {
  apiHost: string,
  maxDuration: string,
  replyTemplate: string,
  longVideoTemplate: string,
  logLevel: number
}

export const Config = Schema.object({
  apiHost: Schema.string().default('http://192.168.2.167:16252').description('填写你的API前缀，不要有斜杠最后'),
  maxDuration: Schema.string().default('90').description('允许下载的最大视频长度(秒)，否则仅发送预览图，避免bot卡住'),
  replyTemplate: Schema.string().default('抖音解析：\n{desc}').description('自定义回复模板，可用变量：{desc}, {nickname}, {type}, {digg_count}, {comment_count}, {share_count}, {collect_count}, {duration}, {signature}').role('textarea'),
  longVideoTemplate: Schema.string().default('视频过长~ 请打开抖音客户端查看').description('视频过长时的提示文本').role('textarea'),
  logLevel: Schema.number().default(2).description('日志级别：0-不记录，1-仅错误，2-常规信息，3-详细信息')
})

export function apply(ctx: Context, config: Config) {

  const logEnabled = config.logLevel > 0
  const logError = config.logLevel >= 1
  const logInfo = config.logLevel >= 2
  const logDetail = config.logLevel >= 3

  function log(level: 'info' | 'success' | 'warn' | 'error', message: string, ...args: any[]) {
    if (!logEnabled) return
    if (level === 'error' && !logError) return
    if ((level === 'info' || level === 'success') && !logInfo) return

    logger[level](message, ...args)
  }

  async function getVideoDetailMinimal(url: string) {
    if (logDetail) log('info', `正在获取抖音链接信息: ${url}`)
    return await ctx.http.get(config.apiHost + '/api/hybrid/video_data?url=' + url + '&minimal=true');
  };

  function formatReply(template: string, data: any) {
    let result = template;
    if (data.desc) result = result.replace(/{desc}/g, data.desc);
    if (data.type) result = result.replace(/{type}/g, data.type);
    if (data.digg_count) result = result.replace(/{digg_count}/g, data.digg_count);
    if (data.comment_count) result = result.replace(/{comment_count}/g, data.comment_count);
    if (data.share_count) result = result.replace(/{share_count}/g, data.share_count);
    if (data.collect_count) result = result.replace(/{collect_count}/g, data.collect_count);
    if (data.duration) result = result.replace(/{duration}/g, data.duration);
    if (data.nickname) result = result.replace(/{nickname}/g, data.nickname);
    if (data.signature) result = result.replace(/{signature}/g, data.signature);


    result = result.replace(/{[^}]+}/g, '');

    return result;
  }

  ctx.middleware(async (session, next) => {
    if (!session.content.includes('douyin.com')) return next()

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urlMatch = session.content.match(urlRegex);
    if (!urlMatch || !urlMatch[0]) return next();

    const url = urlMatch[0];
    if (logInfo) log('info', `检测到抖音链接: ${url}, 用户: ${session.username || session.userId}`)

    try {
      if (logDetail) log('info', `开始请求API获取视频信息`)
      const response = await getVideoDetailMinimal(url);

      if (response.code !== 200) {
        log('warn', `解析失败: ${url}, 状态码: ${response.code}`)
        return '解析失败! 该链接或许不支持';
      }

      const {
        data: {
          desc,
          image_data,
          music,
          author = {},
          statistics = {},
          aweme_id
        }
      } = response;

      const isTypeImage = image_data && Object.keys(image_data).length > 0;
      const contentType = isTypeImage ? '图片' : '视频';

      const digg_count = statistics.digg_count || 0;
      const comment_count = statistics.comment_count || 0;
      const share_count = statistics.share_count || 0;
      const collect_count = statistics.collect_count || 0;
      const duration = music?.duration || 0;
      const nickname = author?.nickname || '未知作者';
      const signature = author?.signature || '';

      if (logDetail) {
        log('info', `解析成功: ${contentType}, ID: ${aweme_id}`, {
          作者: nickname,
          类型: contentType,
          时长: duration,
          点赞: digg_count,
          评论: comment_count
        })
      } else if (logInfo) {
        log('success', `解析成功: ${contentType}, 作者: ${nickname}, 时长: ${duration}秒`)
      }

      const replyText = formatReply(config.replyTemplate, {
        desc,
        type: contentType,
        digg_count,
        comment_count,
        share_count,
        collect_count,
        duration,
        nickname,
        signature
      });

      await session.send(replyText);

      if (isTypeImage) {
        const {
          no_watermark_image_list
        } = image_data;

        if (logDetail) log('info', `开始下载图片, 数量: ${no_watermark_image_list.length}`)

        if (no_watermark_image_list.length > 3) {
          const forwardMessages = await Promise.all(no_watermark_image_list.map(async (item) => {
            return h('img', { src: item })
          }));
          const forwardMessage = h('message', { forward: true, children: forwardMessages });
          await session.send(forwardMessage);
          if (logInfo) log('success', `已发送${no_watermark_image_list.length}张图片(合并转发)`)
        } else {
          no_watermark_image_list.forEach(async item => {
            await session.send(h('img', { src: item }))
          });
          if (logInfo) log('success', `已发送${no_watermark_image_list.length}张图片`)
        }
      } else {
        const videoDuration = music && music.duration
        if (videoDuration > config.maxDuration) {
          const {
            data: {
              cover_data: coverData
            }
          } = response;

          if (logInfo) log('warn', `视频时长(${videoDuration}秒)超过限制(${config.maxDuration}秒), 仅发送预览图`)

          await session.send(config.longVideoTemplate);
          await session.send(h('img', { src: coverData?.dynamic_cover?.url_list[0] }))
        } else {
          if (logDetail) log('info', `开始下载视频, 时长: ${videoDuration}秒`)

          const videoBuffer = await ctx.http.get<ArrayBuffer>(config.apiHost + '/api/download?url=' + url + '&prefix=true&with_watermark=true', {
            responseType: 'arraybuffer',
          });

          if (logInfo) log('success', `视频下载完成, 大小: ${(videoBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`)

          session.send(h.video(videoBuffer, 'video/mp4'))
        }
      }
    } catch(err) {
      log('error', `解析抖音链接出错: ${url}`, err)
      console.log(err);
      return `发生错误! 请重试; ${err}`;
    }
  });

  log('success', `抖音解析插件已启动, API地址: ${config.apiHost}`)
}

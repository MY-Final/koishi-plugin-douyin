# @final/koishi-plugin-douyin

[![npm](https://img.shields.io/npm/v/@final/koishi-plugin-douyin?style=flat-square)](https://www.npmjs.com/package/@final/koishi-plugin-douyin)

> 原插件: [koishi-plugin-douyin](https://www.npmjs.com/package/koishi-plugin-douyin) by [TEDIORELEE](https://github.com/tediorelee)
> 添加了自定义回复模板、日志功能

## 功能简介

解析群聊中的抖音视频/图片分享链接，支持以下功能：

- 自动解析群聊中的抖音链接
- 支持图片和视频内容
- 自定义回复模板（支持多种变量）
- 完整的日志记录
- 视频时长限制，避免下载过大视频

## 配置项

- `apiHost`: API服务器地址
- `maxDuration`: 允许下载的最大视频长度(秒)
- `replyTemplate`: 自定义回复模板
- `longVideoTemplate`: 视频过长时的提示文本
- `logLevel`: 日志级别设置

## 自定义回复模板

在回复模板中可以使用以下变量：
- `{desc}`: 视频描述
- `{nickname}`: 作者昵称
- `{type}`: 内容类型（图片/视频）
- `{digg_count}`: 点赞数
- `{comment_count}`: 评论数
- `{share_count}`: 分享数
- `{collect_count}`: 收藏数
- `{duration}`: 视频时长(秒)
- `{signature}`: 作者签名

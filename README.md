# Podcast RSS Site

一个简洁的 RSS 播客 / 节目站点，适合部署到 GitHub + Vercel。

## 已支持

- 多 RSS 源订阅
- 最近更新首页布局
- 仅保留标题的节目列表
- 音频可直接站内播放（如果 RSS 提供音频地址）
- 播放进度本地记忆（localStorage）
- 黑白主题切换（浅色 / 深色）
- RSS 通过 Next.js Route Handler 代理抓取，避免前端跨域问题

## 本地预览

```bash
npm install
npm run dev
```

打开 <http://localhost:3000>

## 修改 RSS 源

编辑 `lib/feeds.ts`

## 部署到 GitHub + Vercel

1. 把项目推到 GitHub 仓库
2. 打开 Vercel，Import Project
3. 选择你的 GitHub 仓库
4. 保持默认 Next.js 配置并部署

## 说明

如果某个 RSS 只是 YouTube / 视频更新流，没有 `audio/mpeg` 之类的 enclosure，那么页面会显示条目，但只能跳转到原始页面播放。

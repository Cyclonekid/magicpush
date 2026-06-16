import { defineConfig } from 'vitepress'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  ignoreDeadLinks: true,
  title: 'MagicPush 魔法推送',
  description: '支持多种消息渠道的推送服务管理平台，通过标准化 REST API 将消息推送到微信、Telegram、飞书、钉钉、邮件、小爱音箱等 20+ 通知渠道',
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'MagicPush 魔法推送' }],
    ['meta', { property: 'og:description', content: '支持 20+ 消息渠道的统一推送服务管理平台' }],
    ['meta', { property: 'og:image', content: '/logo.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap', rel: 'stylesheet' }]
  ],
  themeConfig: {
    nav: [
      { text: '功能特性', link: '#features' },
      { text: '部署文档', link: '#deploy' },
      {
        text: '推送渠道配置',
        items: [
          { text: '企业微信应用', link: '/guide/channels/wecomapp' },
          { text: '企业微信群机器人', link: '/guide/channels/wecom' },
          { text: '钉钉', link: '/guide/channels/dingtalk' },
          { text: '飞书', link: '/guide/channels/feishu' },
          { text: 'Telegram', link: '/guide/channels/telegram' },
          { text: 'SMTP 邮件', link: '/guide/channels/smtp' },
          { text: 'Webhook', link: '/guide/channels/webhook' },
          { text: 'PushPlus', link: '/guide/channels/pushplus' },
          { text: 'Server酱', link: '/guide/channels/serverchan' },
          { text: 'Bark', link: '/guide/channels/bark' },
          { text: 'WxPusher', link: '/guide/channels/wxpusher' },
          { text: '微信公众号', link: '/guide/channels/wechat-official' },
          { text: '微信龙虾机器人', link: '/guide/channels/wechatclawbot' },
          { text: 'PushDeer', link: '/guide/channels/pushdeer' },
          { text: 'PushMe', link: '/guide/channels/pushme' },
          { text: 'ntfy', link: '/guide/channels/ntfy' },
          { text: 'Meow', link: '/guide/channels/meow' },
          { text: '小爱音箱', link: '/guide/channels/misound' },
          { text: 'iGot', link: '/guide/channels/igot' },
          { text: 'Gotify', link: '/guide/channels/gotify' },
          { text: '息知', link: '/guide/channels/xizhi' },
          { text: '元宝Bot', link: '/guide/channels/yuanbaobot' },
          { text: 'ShowDoc', link: '/guide/channels/showdoc' },
          { text: 'Synology Chat', link: '/guide/channels/synologychat' },
          { text: 'QQ机器人', link: '/guide/channels/qqbot' },
        ]
      },
      { text: '更新日志', link: '#changelog' },
      {
        text: '在线 Demo',
        link: 'https://uptimeflare-ept.pages.dev/',
        target: '_blank'
      },
      {
        text: 'GitHub',
        link: 'https://github.com/magiccode1412/magicpush',
        target: '_blank'
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/magiccode1412/magicpush' }
    ],
    footer: {
      message: '基于 MIT 许可证开源',
      copyright: '&copy; 2026 magiccode1412. All rights reserved.'
    }
  },
  vite: {
    css: {
      postcss: {
        plugins: [
          tailwindcss,
          autoprefixer
        ]
      }
    },
    server: {
      host: '0.0.0.0',
      allowedHosts: true
    }
  }
})

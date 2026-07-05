import { defineConfig } from 'vitepress'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  ignoreDeadLinks: true,
  title: 'MagicPush 魔法推送',
  description: '支持多种消息渠道的推送服务管理平台，通过标准化 REST API 将消息推送到微信、Telegram、飞书、钉钉、邮件、小爱音箱等 20+ 通知渠道',
  
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'MagicPush 魔法推送' }],
    ['meta', { property: 'og:description', content: '支持 20+ 消息渠道的统一推送服务管理平台' }],
    ['meta', { property: 'og:image', content: '/logo.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }]
  ],

  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: '应用场景', link: '/guide/use-cases' },
      { text: '接口管理', items: [
        { text: '消息免打扰', link: '/guide/api/do-not-disturb' },
        { text: '入站配置', link: '/guide/api/inbound-config' },
        { text: '关键词过滤', link: '/guide/api/keyword-filter' }
      ]},
      { text: '推送渠道配置', items: [
        { text: '各渠道频率限制', link: '/guide/channels/rate-limits' },
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
        { text: 'PushDeer', link: '/guide/channels/pushdeer' },
        { text: 'PushMe', link: '/guide/channels/pushme' },
        { text: 'ntfy', link: '/guide/channels/ntfy' },
        { text: '小爱音箱', link: '/guide/channels/misound' },
        { text: 'iGot', link: '/guide/channels/igot' },
        { text: 'Gotify', link: '/guide/channels/gotify' },
        { text: '息知', link: '/guide/channels/xizhi' },
        { text: 'Synology Chat', link: '/guide/channels/synologychat' },
        { text: 'QQ机器人', link: '/guide/channels/qqbot' }
      ]},
      { text: '开发文档', link: '/guide/dev/overview' },
      { text: '更新日志', link: '/guide/changelog' },
      { text: 'GitHub', link: 'https://github.com/magiccode1412/magicpush', target: '_blank' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: '快速开始',
          items: [
            { text: '简介', link: '/guide/getting-started' }
          ]
        },
        {
          text: '部署',
          items: [
            { text: 'Docker 部署', link: '/guide/deploy/docker' },
            { text: '飞牛NAS', link: '/guide/deploy/feiNiu' }
          ]
        },
        {
          text: '应用场景',
          items: [
            { text: '典型应用案例', link: '/guide/use-cases' }
          ]
        },
        {
          text: '接口管理',
          items: [
            { text: '消息免打扰', link: '/guide/api/do-not-disturb' },
            { text: '入站配置', link: '/guide/api/inbound-config' },
            { text: '关键词过滤', link: '/guide/api/keyword-filter' }
          ]
        },
        {
          text: '推送渠道配置',
          items: [
            { text: '各渠道频率限制', link: '/guide/channels/rate-limits' },
            {
              text: '详细渠道配置',
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
                { text: 'PushDeer', link: '/guide/channels/pushdeer' },
                { text: 'PushMe', link: '/guide/channels/pushme' },
                { text: 'ntfy', link: '/guide/channels/ntfy' },
                { text: '小爱音箱', link: '/guide/channels/misound' },
                { text: 'iGot', link: '/guide/channels/igot' },
                { text: 'Gotify', link: '/guide/channels/gotify' },
                { text: '息知', link: '/guide/channels/xizhi' },
                { text: 'Synology Chat', link: '/guide/channels/synologychat' },
                { text: 'QQ机器人', link: '/guide/channels/qqbot' },
                { text: '微信群机器人', link: '/guide/channels/wechatclawbot' },
                { text: '微信公众号', link: '/guide/channels/wechat-official' },
                { text: '喵呜', link: '/guide/channels/meow' },
                { text: '圆宝', link: '/guide/channels/yuanbaobot' },
                { text: 'ShowDoc', link: '/guide/channels/showdoc' }
              ]
            }
          ]
        },
        {
          text: '开发文档',
          items: [
            { text: '项目概览', link: '/guide/dev/overview' },
            { text: '架构设计', link: '/guide/dev/architecture' },
            { text: '数据库设计', link: '/guide/dev/database' },
            { text: 'API 接口文档', link: '/guide/dev/api-reference' }
          ]
        },
        {
          text: '开发规范',
          items: [
            { text: '命名规范', link: '/guide/dev/naming-conventions' },
            { text: '代码风格规范', link: '/guide/dev/coding-standards' },
            { text: '后端开发指南', link: '/guide/dev/backend-development' },
            { text: '前端开发指南', link: '/guide/dev/frontend-guide' }
          ]
        },
        {
          text: '扩展指南',
          items: [
            { text: '新增渠道开发', link: '/guide/dev/new-channel-guide' },
            { text: '特有消息类型开发', link: '/guide/dev/channel-specific-types' }
          ]
        },
        {
          text: '其他',
          items: [
            { text: '更新日志', link: '/guide/changelog' },
            { text: '隐私政策', link: '/guide/privacy-policy' },
            { text: '服务条款', link: '/guide/terms-of-service' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/magiccode1412/magicpush' }
    ],

    footer: {
      message: '基于 MIT 许可证开源',
      copyright: '&copy; 2026 magiccode1412. All rights reserved.'
    }
  },

  vite: {
    server: {
      host: '0.0.0.0',
      allowedHosts: true
    }
  }
})

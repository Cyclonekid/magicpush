import { defineConfig } from 'vitepress'
import { isDev } from './channel'

const siteDomain = 'https://magicpush.160621.xyz'
const siteTitle = 'MagicPush 魔法推送'
const siteDescription = '支持多种消息渠道的推送服务管理平台，通过标准化 REST API 将消息推送到微信、Telegram、飞书、钉钉、邮件、小爱音箱等 20+ 通知渠道'
const siteKeywords = 'MagicPush, 魔法推送, 消息推送, 推送服务, REST API, 微信推送, Telegram, 飞书, 钉钉, 邮件推送, 多渠道推送, 开源推送平台'
const ogImage = `${siteDomain}/logo.png`

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  cleanUrls: true,
  ignoreDeadLinks: true,
  title: siteTitle,
  titleTemplate: ':title | MagicPush',
  description: siteDescription,

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
    ['link', { rel: 'canonical', href: siteDomain }],
    ['meta', { charset: 'utf-8' }],
    ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1.0' }],
    ['meta', { name: 'description', content: siteDescription }],
    ['meta', { name: 'keywords', content: siteKeywords }],
    ['meta', { name: 'author', content: 'magiccode1412' }],
    ['meta', { name: 'robots', content: 'index, follow' }],
    ['meta', { property: 'og:site_name', content: siteTitle }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: siteTitle }],
    ['meta', { property: 'og:description', content: siteDescription }],
    ['meta', { property: 'og:url', content: siteDomain }],
    ['meta', { property: 'og:image', content: ogImage }],
    ['meta', { property: 'og:image:width', content: '512' }],
    ['meta', { property: 'og:image:height', content: '512' }],
    ['meta', { property: 'og:image:alt', content: `${siteTitle} Logo` }]
  ],

  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: '应用场景', link: '/guide/use-cases' },
      {
        text: '接口管理', items: [
          { text: '消息免打扰', link: '/guide/api/do-not-disturb' },
          { text: '入站配置', link: '/guide/api/inbound-config' },
          { text: '关键词过滤', link: '/guide/api/keyword-filter' },
          { text: '内容替换', link: '/guide/api/content-replace' }
        ]
      },
      {
        text: '推送渠道配置', items: [
          { text: '各渠道频率限制', link: '/guide/channels/rate-limits' },
          { text: '详细渠道配置', link: '/guide/channels/overview' }
        ]
      },
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
            { text: '关键词过滤', link: '/guide/api/keyword-filter' },
            { text: '内容替换', link: '/guide/api/content-replace' }
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
                { text: 'meow', link: '/guide/channels/meow' },
                { text: '元宝机器人', link: '/guide/channels/yuanbaobot' },
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
            { text: '测试指南', link: '/guide/dev/testing' },
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

  sitemap: {
    hostname: siteDomain,
    transformItems(items) {
      return items.map((item) => {
        item.changefreq = item.url === '' ? 'daily' : 'weekly'
        item.priority = item.url === '' ? 1.0 : 0.7
        return item
      })
    }
  },

  vite: {
    // 将构建渠道判定编译期注入客户端全局常量，供自定义主题组件条件渲染使用。
    // stable 构建下条件分支会被折叠消除，不影响正式版体积与渲染路径。
    define: {
      __IS_DEV_DOCS__: JSON.stringify(isDev)
    },
    server: {
      host: '0.0.0.0',
      allowedHosts: true
    }
  }
})

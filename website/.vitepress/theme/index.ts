import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import DevBanner from './components/DevBanner.vue'
import DevBadge from './components/DevBadge.vue'

// __IS_DEV_DOCS__ 由 config.js 中 vite.define 在构建期注入（boolean）。
// .ts 文件不在本仓库 ESLint 校验范围内，可安全引用该构建期常量。
export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.provide('isDevDocs', __IS_DEV_DOCS__)
  },
  Layout: () => h(DefaultTheme.Layout, null, {
    // 顶部整宽提示横幅：仅在开发版（dev 渠道）构建时渲染
    'layout-top': () => h(DevBanner),
    // 导航标题旁的「开发版」徽标：仅在开发版构建时渲染
    'nav-bar-title-after': () => h(DevBadge)
  })
}

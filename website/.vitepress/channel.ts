// 文档构建渠道判定
// 复用 .github/workflows/docs.yml 中定义的 DOCS_CHANNEL 环境变量：
//   - stable：正式版文档（main 分支构建，GitHub Pages 部署）
//   - dev   ：开发版文档（dev 分支构建，由 EdgeOne 等平台自动构建）
// 本地 pnpm dev / pnpm build 未设置该变量时，默认按正式版（stable）处理。

const channel = (process.env.DOCS_CHANNEL || 'stable').toLowerCase()

export type DocsChannel = 'stable' | 'dev'

export const docsChannel: DocsChannel = channel === 'dev' ? 'dev' : 'stable'

export const isDev: boolean = docsChannel === 'dev'

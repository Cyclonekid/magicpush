<script setup>
import { inject } from 'vue'

// 由主题入口 app.provide('isDevDocs', ...) 注入，仅在 dev 渠道构建时为 true
const isDev = inject('isDevDocs', false)
</script>

<template>
  <div v-if="isDev" class="dev-banner" role="alert">
    🧪 您正在查看<strong>开发版文档</strong>（dev 分支构建），内容可能包含未完成的功能，请以
    <a href="https://magicpush.160621.xyz" target="_blank" rel="noopener">正式版文档</a>
    为准。
  </div>
</template>

<style scoped>
.dev-banner {
  background: linear-gradient(90deg, #f59e0b, #ef4444);
  color: #fff;
  text-align: center;
  font-size: 0.85rem;
  line-height: 1.5;
  padding: 0.5rem 1rem;
}

.dev-banner a {
  color: #fff;
  font-weight: 600;
  text-decoration: underline;
}

.dev-banner a:hover {
  opacity: 0.85;
}
</style>

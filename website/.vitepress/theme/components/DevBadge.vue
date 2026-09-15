<script setup>
import { inject } from 'vue'

// 由主题入口 app.provide('isDevDocs', ...) 注入，仅在 dev 渠道构建时为 true
const isDev = inject('isDevDocs', false)
</script>

<template>
  <span v-if="isDev" class="dev-badge">开发版</span>
</template>

<style scoped>
.dev-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.12rem 0.45rem;
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.02em;
  color: #fff;
  background: linear-gradient(90deg, #f59e0b, #ef4444);
  border-radius: 999px;
  vertical-align: middle;
  white-space: nowrap;
}
</style>

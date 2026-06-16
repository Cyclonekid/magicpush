<template>
  <!-- Homepage Layout -->
  <div v-if="isHome" class="min-h-screen bg-[#0F0F1A]">
    <!-- Fixed Navigation -->
    <AppHeader />

    <main>
      <!-- Hero Section -->
      <HeroSection />

      <!-- Pain Points -->
      <PainPointsSection />

      <!-- Architecture Comparison -->
      <ArchitectureSection />

      <!-- Core Features -->
      <FeaturesSection id="features" />

      <!-- Supported Channels -->
      <ChannelsSection />

      <!-- Product Preview -->
      <PreviewSection />

      <!-- Tech Stack -->
      <TechStackSection />

      <!-- Deployment Guide -->
      <DeploySection id="deploy" />

      <!-- Changelog -->
      <ChangelogSection id="changelog" />
    </main>

    <!-- Footer -->
    <AppFooter />
  </div>

  <!-- Content Page Layout (e.g. channel guide pages) -->
  <div v-else class="min-h-screen bg-[#0F0F1A]">
    <AppHeader />
    <div class="pt-20 pb-16">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <article class="prose prose-invert prose-purple max-w-none
          prose-headings:text-white
          prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
          prose-p:text-slate-300 prose-p:leading-relaxed
          prose-a:text-purple-400 prose-a:no-underline hover:prose-a:text-purple-300
          prose-code:text-purple-300 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
          prose-pre:bg-[#1a1a2e] prose-pre:border prose-pre:border-white/10
          prose-img:rounded-xl
          prose-li:text-slate-300
          prose-strong:text-white
          prose-table:text-slate-300 prose-th:text-white prose-th:bg-white/5 prose-td:border-white/10
          prose-blockquote:text-slate-400 prose-blockquote:border-l-purple-500
          prose-hr:border-white/10
        ">
          <Content />
        </article>
      </div>
    </div>
    <AppFooter />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useData } from 'vitepress'

const { page } = useData()
const isHome = computed(() => page.value.relativePath === 'index.md')

// Scroll reveal observer
onMounted(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed')
        }
      })
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  )

  document.querySelectorAll('.animate-reveal').forEach(el => observer.observe(el))
})
</script>

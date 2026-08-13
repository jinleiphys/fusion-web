<template>
  <footer v-if="$nav.currentPage <= 29" class="slide-page-number">
    {{ $nav.currentPage }} / 29
  </footer>
</template>

<style scoped>
.slide-page-number {
  position: fixed;
  bottom: 14px;
  right: 22px;
  z-index: 999;
  pointer-events: none;
  font-family: 'Inter', -apple-system, 'PingFang SC', sans-serif;
  font-weight: 500;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: #87867f;       /* --stone, warm tertiary */
  opacity: 0.85;
}
</style>

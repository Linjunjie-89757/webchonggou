<template>
  <section class="case-center-page">
    <div class="case-center-page__content">
      <RouterView />
    </div>
  </section>
</template>

<style scoped>
.case-center-page {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.case-center-page__content {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
}

.case-center-page__content > :deep(*) {
  flex: 1;
  min-width: 0;
  min-height: 0;
}
</style>

<script setup lang="ts">
import {
  Cpu,
  Files,
  Grid,
  Monitor,
  Setting,
  Tools,
  User,
  Warning,
} from '@element-plus/icons-vue'

const navigationItems = [
  { path: '/', label: '工作台', icon: Grid },
  { path: '/config-center', label: '配置中心', icon: Setting },
  { path: '/cases', label: '用例中心', icon: Files },
  { path: '/bugs', label: '缺陷管理', icon: Warning },
  { path: '/automation/api', label: '接口自动化', icon: Cpu },
  { path: '/automation/web', label: 'Web UI 自动化', icon: Monitor },
  { path: '/automation/app', label: 'APP 自动化', icon: Tools },
  { path: '/settings', label: '系统设置', icon: User },
]
</script>

<template>
  <div class="app-layout">
    <aside class="app-layout__sidebar">
      <div class="app-layout__brand">
        <span class="app-layout__brand-mark">A</span>
        <span>自动化测试平台</span>
      </div>

      <nav class="app-layout__nav" aria-label="主导航">
        <RouterLink
          v-for="item in navigationItems"
          :key="item.path"
          class="app-layout__nav-item"
          :to="item.path"
          active-class="is-active"
        >
          <el-icon class="app-layout__nav-icon">
            <component :is="item.icon" />
          </el-icon>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <section class="app-layout__body">
      <header class="app-layout__header">
        <div class="app-layout__header-title">前端 2.0 重建</div>
        <div class="app-layout__header-meta">Vue3 · TypeScript · Element Plus</div>
      </header>

      <main class="app-layout__main">
        <RouterView />
      </main>
    </section>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100dvh;
  background: var(--app-bg-page);
  color: var(--app-text-primary);
}

.app-layout__sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: var(--app-sidebar-width);
  border-right: 1px solid var(--app-border);
  background: var(--app-bg-panel);
}

.app-layout__brand {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  height: 64px;
  padding: 0 var(--app-space-5);
  border-bottom: 1px solid var(--app-border-soft);
  font-size: var(--app-font-size-lg);
  font-weight: 700;
}

.app-layout__brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--app-radius-md);
  background: var(--app-primary);
  color: var(--app-text-inverse);
  font-size: var(--app-font-size-md);
}

.app-layout__nav {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-1);
  padding: var(--app-space-4) var(--app-space-3);
}

.app-layout__nav-item {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  min-height: 40px;
  padding: 0 var(--app-space-3);
  border-radius: var(--app-radius-md);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-md);
  font-weight: 500;
  text-decoration: none;
  transition: background-color 160ms ease, color 160ms ease;
}

.app-layout__nav-item:hover {
  background: var(--app-bg-muted);
  color: var(--app-text-primary);
}

.app-layout__nav-item.is-active {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.app-layout__nav-icon {
  width: 18px;
  font-size: 18px;
}

.app-layout__body {
  flex: 1;
  min-width: 0;
  margin-left: var(--app-sidebar-width);
}

.app-layout__header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 var(--app-space-6);
  border-bottom: 1px solid var(--app-border);
  background: rgb(255 255 255 / 0.92);
  backdrop-filter: blur(10px);
}

.app-layout__header-title {
  font-size: var(--app-font-size-lg);
  font-weight: 700;
}

.app-layout__header-meta {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.app-layout__main {
  min-height: calc(100dvh - 64px);
  padding: var(--app-space-6);
}

@media (max-width: 900px) {
  .app-layout {
    flex-direction: column;
  }

  .app-layout__sidebar {
    position: static;
    width: 100%;
  }

  .app-layout__nav {
    overflow-x: auto;
    flex-direction: row;
    padding: var(--app-space-3);
  }

  .app-layout__nav-item {
    flex: 0 0 auto;
  }

  .app-layout__body {
    margin-left: 0;
  }

  .app-layout__header {
    padding: 0 var(--app-space-4);
  }

  .app-layout__main {
    padding: var(--app-space-4);
  }
}
</style>

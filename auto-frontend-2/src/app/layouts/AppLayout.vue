<script setup lang="ts">
import {
  ArrowDown,
  Cpu,
  Files,
  Grid,
  Monitor,
  Setting,
  SwitchButton,
  Tools,
  User,
  Warning,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSession } from '@/entities/session'
import { useLogout } from '@/features/auth-logout'

const router = useRouter()
const route = useRoute()
const { currentUser } = useSession()
const { loading: logoutLoading, errorMessage: logoutErrorMessage, logout } = useLogout()

const headerTitle = computed(() => {
  return typeof route.meta.title === 'string' && route.meta.title ? route.meta.title : '前端 2.0 重建'
})

const headerDescription = computed(() => {
  return typeof route.meta.description === 'string' && route.meta.description
    ? route.meta.description
    : 'Vue3 · TypeScript · Element Plus'
})

const userDisplayName = computed(() => {
  const user = currentUser.value
  return user?.displayName || user?.username || '当前用户'
})

const userRoleText = computed(() => currentUser.value?.roleCode || '已登录')

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

function isNavigationActive(path: string) {
  return route.path === path
}

async function handleLogout() {
  if (logoutLoading.value) {
    return
  }

  try {
    await logout()
    await router.replace('/login')
  } catch {
    ElMessage.error(logoutErrorMessage.value || '退出登录失败，请稍后重试')
  }
}
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
          :class="{ 'is-active': isNavigationActive(item.path) }"
          :to="item.path"
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
        <div class="app-layout__header-copy">
          <div class="app-layout__header-title">{{ headerTitle }}</div>
          <div class="app-layout__header-meta">{{ headerDescription }}</div>
        </div>

        <el-dropdown trigger="click" @command="handleLogout">
          <button
            class="app-layout__user"
            type="button"
            :aria-busy="logoutLoading"
            :disabled="logoutLoading"
          >
            <span class="app-layout__user-avatar">{{ userDisplayName.slice(0, 1).toUpperCase() }}</span>
            <span class="app-layout__user-main">
              <span class="app-layout__user-name">{{ userDisplayName }}</span>
              <span class="app-layout__user-role">{{ userRoleText }}</span>
            </span>
            <el-icon class="app-layout__user-arrow">
              <ArrowDown />
            </el-icon>
          </button>

          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout" :disabled="logoutLoading">
                <el-icon>
                  <SwitchButton />
                </el-icon>
                {{ logoutLoading ? '正在退出' : '退出登录' }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
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
  gap: var(--app-space-4);
  height: 64px;
  padding: 0 var(--app-space-6);
  border-bottom: 1px solid var(--app-border);
  background: rgb(255 255 255 / 0.92);
  backdrop-filter: blur(10px);
}

.app-layout__header-copy {
  min-width: 0;
}

.app-layout__header-title {
  overflow: hidden;
  font-size: var(--app-font-size-lg);
  font-weight: 700;
  line-height: var(--app-line-height-lg);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-layout__header-meta {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-layout__user {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-space-2);
  max-width: 260px;
  min-height: 40px;
  padding: 0 var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
  cursor: pointer;
  transition: border-color 160ms ease, background-color 160ms ease;
}

.app-layout__user:disabled {
  cursor: wait;
  opacity: 0.72;
}

.app-layout__user:hover {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
}

.app-layout__user-avatar {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--app-radius-sm);
  background: var(--app-primary);
  color: var(--app-text-inverse);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.app-layout__user-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.2;
}

.app-layout__user-name {
  max-width: 150px;
  overflow: hidden;
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-layout__user-role {
  max-width: 150px;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-layout__user-arrow {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: 14px;
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

@media (max-width: 560px) {
  .app-layout__header {
    align-items: flex-start;
    height: auto;
    min-height: 64px;
    padding-block: var(--app-space-3);
  }

  .app-layout__header-copy {
    flex: 1 1 auto;
  }

  .app-layout__header-title {
    max-width: 100%;
  }

  .app-layout__header-meta {
    max-width: 100%;
  }

  .app-layout__user {
    max-width: 156px;
  }

  .app-layout__user-name,
  .app-layout__user-role {
    max-width: 72px;
  }
}
</style>

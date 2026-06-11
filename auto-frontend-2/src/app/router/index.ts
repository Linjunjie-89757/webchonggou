import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import AppLayout from '@/app/layouts/AppLayout.vue'
import { loadCurrentUser, sessionState } from '@/entities/session'
import ApiAutomationPage from '@/pages/automation-api/ApiAutomationPage.vue'
import CasesPage from '@/pages/cases/CasesPage.vue'
import ConfigCenterPage from '@/pages/config-center/ConfigCenterPage.vue'
import DefectsPage from '@/pages/defects/DefectsPage.vue'
import LoginPage from '@/pages/login/LoginPage.vue'
import PlaceholderPage from '@/pages/placeholder/PlaceholderPage.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: {
      title: '登录',
      bare: true,
      public: true,
    },
  },
  {
    path: '/',
    component: AppLayout,
    children: [
      {
        path: '',
        name: 'dashboard',
        component: PlaceholderPage,
        meta: {
          title: '工作台',
          description: '保持旧项目克制的占位页风格，后续按模块迁移实际内容。',
        },
      },
      {
        path: 'settings',
        name: 'settings',
        component: PlaceholderPage,
        meta: {
          title: '系统设置',
          description: '后续拆分为设置分类侧栏、AI 连接池、空间配置等 widgets。',
        },
      },
      {
        path: 'config-center',
        name: 'config-center',
        component: ConfigCenterPage,
        meta: {
          title: '配置中心',
          description: '后续保持公共配置边界，迁移环境、参数、数据库连接配置。',
        },
      },
      {
        path: 'cases',
        name: 'cases',
        component: CasesPage,
        meta: {
          title: '用例中心',
          description: '后续按目录树、筛选区、表格、抽屉等区域拆分。',
        },
      },
      {
        path: 'bugs',
        name: 'bugs',
        component: DefectsPage,
        meta: {
          title: '缺陷管理',
          description: '按工作空间查看缺陷统计和真实列表，后续继续补齐详情与流转。',
        },
      },
      {
        path: 'automation/api',
        name: 'automation-api',
        component: ApiAutomationPage,
        meta: {
          title: '接口自动化',
          description: '后续先输出拆分方案，再迁移执行工作台，不复制旧大组件。',
        },
      },
      {
        path: 'automation/web',
        name: 'automation-web',
        component: PlaceholderPage,
        meta: {
          title: 'Web UI 自动化',
          description: '旧项目当前为占位模块，后续确认真实业务边界后再接入。',
        },
      },
      {
        path: 'automation/app',
        name: 'automation-app',
        component: PlaceholderPage,
        meta: {
          title: 'APP 自动化',
          description: '旧项目当前为占位模块，后续确认真实业务边界后再接入。',
        },
      },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const isPublicRoute = to.meta.public === true

  if (!sessionState.sessionChecked.value) {
    await loadCurrentUser()
  }

  if (to.name === 'login' && sessionState.isAuthenticated.value) {
    return { path: '/config-center', replace: true }
  }

  if (!isPublicRoute && !sessionState.isAuthenticated.value) {
    return {
      path: '/login',
      query: to.fullPath === '/' ? undefined : { redirect: to.fullPath },
      replace: true,
    }
  }

  return true
})

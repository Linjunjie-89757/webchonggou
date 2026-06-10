import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import AppLayout from '@/app/layouts/AppLayout.vue'
import ConfigCenterPage from '@/pages/config-center/ConfigCenterPage.vue'
import PlaceholderPage from '@/pages/placeholder/PlaceholderPage.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: PlaceholderPage,
    meta: {
      title: '登录',
      description: '账号登录能力将在后续迁移阶段接入。',
      bare: true,
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
        component: PlaceholderPage,
        meta: {
          title: '用例中心',
          description: '后续按目录树、筛选区、表格、抽屉等区域拆分。',
        },
      },
      {
        path: 'bugs',
        name: 'bugs',
        component: PlaceholderPage,
        meta: {
          title: '缺陷管理',
          description: '后续迁移列表、详情、编辑和关联弹窗的统一视觉。',
        },
      },
      {
        path: 'automation/api',
        name: 'automation-api',
        component: PlaceholderPage,
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
          description: '当前阶段仅建立占位页。',
        },
      },
      {
        path: 'automation/app',
        name: 'automation-app',
        component: PlaceholderPage,
        meta: {
          title: 'APP 自动化',
          description: '当前阶段仅建立占位页。',
        },
      },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

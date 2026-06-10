<script setup lang="ts">
import { computed, reactive } from 'vue'
import { Lock, User } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'

import { useLogin } from '@/features/auth-login'

const router = useRouter()
const route = useRoute()
const { loading, errorMessage, login } = useLogin()

const form = reactive({
  username: '',
  password: '',
})

const canSubmit = computed(() => Boolean(form.username.trim() && form.password))

function resolveRedirect() {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/config-center'
}

async function handleSubmit() {
  if (!canSubmit.value || loading.value) {
    return
  }

  try {
    await login({
      username: form.username.trim(),
      password: form.password,
    })
    await router.replace(resolveRedirect())
  } catch {
    // useLogin exposes a stable, normalized error message for the page.
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-page__panel">
      <div class="login-page__brand">
        <span class="login-page__brand-mark">A</span>
        <div>
          <h1 class="login-page__title">自动化测试平台</h1>
          <p class="login-page__subtitle">前端 2.0</p>
        </div>
      </div>

      <el-form class="login-page__form" :model="form" @submit.prevent="handleSubmit">
        <el-alert
          v-if="errorMessage"
          class="login-page__error"
          :title="errorMessage"
          type="error"
          show-icon
          :closable="false"
        />

        <el-form-item>
          <el-input
            v-model="form.username"
            :prefix-icon="User"
            autocomplete="username"
            clearable
            placeholder="用户名"
            size="large"
          />
        </el-form-item>

        <el-form-item>
          <el-input
            v-model="form.password"
            :prefix-icon="Lock"
            autocomplete="current-password"
            placeholder="密码"
            show-password
            size="large"
            type="password"
            @keyup.enter="handleSubmit"
          />
        </el-form-item>

        <el-button
          class="login-page__submit"
          type="primary"
          native-type="submit"
          size="large"
          :loading="loading"
          :disabled="!canSubmit || loading"
        >
          登录
        </el-button>
      </el-form>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: 100dvh;
  place-items: center;
  padding: var(--app-space-6);
  background:
    linear-gradient(180deg, rgb(255 255 255 / 0.72), rgb(255 255 255 / 0.94)),
    var(--app-bg-page);
}

.login-page__panel {
  width: min(420px, 100%);
  padding: var(--app-space-6);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-card);
}

.login-page__brand {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  margin-bottom: var(--app-space-6);
}

.login-page__brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--app-radius-md);
  background: var(--app-primary);
  color: var(--app-text-inverse);
  font-size: var(--app-font-size-lg);
  font-weight: 700;
}

.login-page__title {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-xl);
  font-weight: 700;
  line-height: 24px;
}

.login-page__subtitle {
  margin: 4px 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.login-page__form {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-1);
}

.login-page__error {
  margin-bottom: var(--app-space-3);
}

.login-page__submit {
  width: 100%;
  margin-top: var(--app-space-2);
}
</style>

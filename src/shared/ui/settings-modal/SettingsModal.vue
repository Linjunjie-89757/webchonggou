<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { X } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    width?: string
    panelClass?: string | Record<string, boolean>
    bodyClass?: string | Record<string, boolean>
    closeOnOverlay?: boolean
  }>(),
  {
    width: '512px',
    panelClass: '',
    bodyClass: '',
    closeOnOverlay: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

let previousBodyOverflow = ''
let previousHtmlOverflow = ''

function close() {
  emit('update:modelValue', false)
}

function handleOverlayClick() {
  if (props.closeOnOverlay) {
    close()
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.modelValue) {
    close()
  }
}

function lockBodyScroll() {
  previousHtmlOverflow = document.documentElement.style.overflow
  previousBodyOverflow = document.body.style.overflow
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', handleKeydown)
}

function unlockBodyScroll() {
  document.documentElement.style.overflow = previousHtmlOverflow
  document.body.style.overflow = previousBodyOverflow
  window.removeEventListener('keydown', handleKeydown)
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      lockBodyScroll()
    } else {
      unlockBodyScroll()
    }
  },
)

onBeforeUnmount(() => {
  if (props.modelValue) {
    unlockBodyScroll()
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="settings-modal-overlay" @click.self="handleOverlayClick">
      <section class="settings-modal-panel" :class="panelClass" :style="{ width }" role="dialog" aria-modal="true">
        <header class="settings-modal-header">
          <h2>{{ title }}</h2>
          <button type="button" aria-label="关闭" @click="close">
            <X :size="16" />
          </button>
        </header>

        <div class="settings-modal-body" :class="bodyClass">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="settings-modal-footer">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.settings-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.32);
  backdrop-filter: blur(6px);
}

.settings-modal-panel {
  display: flex;
  max-width: 100%;
  max-height: 90vh;
  flex-direction: column;
  overflow: hidden;
  border-radius: 16px;
  background: var(--app-bg-panel);
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 25%);
  font-family: var(--app-font-family);
}

.settings-modal-header,
.settings-modal-footer {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  border-color: var(--app-border-soft);
}

.settings-modal-header {
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--app-border-soft);
}

.settings-modal-header h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.45;
}

.settings-modal-header button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  transition: background-color 180ms ease, color 180ms ease;
}

.settings-modal-header button:hover {
  background: var(--app-border-soft);
  color: var(--app-text-primary);
}

.settings-modal-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 24px;
  scrollbar-width: none;
}

.settings-modal-body::-webkit-scrollbar {
  display: none;
}

.settings-modal-footer {
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--app-border-soft);
}
</style>

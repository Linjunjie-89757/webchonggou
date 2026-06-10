import type { App } from 'vue'
import { createPinia } from 'pinia'

export function setupAppProviders(app: App) {
  app.use(createPinia())
}

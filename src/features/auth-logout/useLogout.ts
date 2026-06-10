import { ref } from 'vue'

import { clearCurrentUser, sessionApi } from '@/entities/session'
import { getRequestErrorMessage, isUnauthorizedError } from '@/shared/api/error'

export function useLogout() {
  const loading = ref(false)
  const errorMessage = ref('')

  async function logout() {
    loading.value = true
    errorMessage.value = ''

    try {
      await sessionApi.logout()
      clearCurrentUser()
    } catch (error) {
      if (isUnauthorizedError(error)) {
        clearCurrentUser()
        return
      }

      errorMessage.value = getRequestErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    errorMessage,
    logout,
  }
}

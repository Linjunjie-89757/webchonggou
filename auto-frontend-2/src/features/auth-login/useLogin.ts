import { ref } from 'vue'

import { sessionApi, setCurrentUser, type LoginPayload } from '@/entities/session'
import { getRequestErrorMessage } from '@/shared/api/error'

export function useLogin() {
  const loading = ref(false)
  const errorMessage = ref('')

  async function login(payload: LoginPayload) {
    loading.value = true
    errorMessage.value = ''

    try {
      const user = await sessionApi.login(payload)
      setCurrentUser(user)
      return user
    } catch (error) {
      errorMessage.value = getRequestErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    errorMessage,
    login,
  }
}

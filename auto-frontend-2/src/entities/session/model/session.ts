import { computed, readonly, ref, shallowRef } from 'vue'

import { sessionApi } from '../api/sessionApi'
import type { CurrentUser } from './types'

const currentUser = shallowRef<CurrentUser | null>(null)
const sessionChecked = ref(false)
let loadingPromise: Promise<CurrentUser | null> | null = null

export const sessionState = {
  currentUser: readonly(currentUser),
  sessionChecked: readonly(sessionChecked),
  isAuthenticated: computed(() => Boolean(currentUser.value)),
}

export function setCurrentUser(user: CurrentUser | null) {
  currentUser.value = user
  sessionChecked.value = true
}

export function clearCurrentUser() {
  currentUser.value = null
  sessionChecked.value = true
}

export async function loadCurrentUser() {
  if (loadingPromise) {
    return loadingPromise
  }

  loadingPromise = sessionApi
    .getCurrentUser()
    .then((user) => {
      setCurrentUser(user)
      return user
    })
    .catch(() => {
      clearCurrentUser()
      return null
    })
    .finally(() => {
      loadingPromise = null
    })

  return loadingPromise
}

export function useSession() {
  return {
    currentUser: sessionState.currentUser,
    sessionChecked: sessionState.sessionChecked,
    isAuthenticated: sessionState.isAuthenticated,
    loadCurrentUser,
    setCurrentUser,
    clearCurrentUser,
  }
}

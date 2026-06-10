export function debounce<T extends (...args: never[]) => void>(callback: T, delay = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined

  const debounced = (...args: Parameters<T>) => {
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => callback(...args), delay)
  }

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  return debounced
}

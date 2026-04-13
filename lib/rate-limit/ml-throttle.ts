const queue: Array<() => void> = []
let inFlight = 0

const MAX_CONCURRENT = 10
const MIN_DELAY_MS = 100

export async function throttledMlFetch<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSlot()
  try {
    return await fn()
  } finally {
    inFlight--
    const next = queue.shift()
    if (next) next()
  }
}

function acquireSlot(): Promise<void> {
  return new Promise((resolve) => {
    const tryRun = () => {
      if (inFlight < MAX_CONCURRENT) {
        inFlight++
        setTimeout(resolve, MIN_DELAY_MS)
      } else {
        queue.push(tryRun)
      }
    }
    tryRun()
  })
}

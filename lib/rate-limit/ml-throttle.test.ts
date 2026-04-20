import { describe, expect, it, vi } from "vitest"

import { throttledMlFetch } from "./ml-throttle"

describe("throttledMlFetch", () => {
  it("executes function and returns result", async () => {
    const result = await throttledMlFetch(() => Promise.resolve(42))
    expect(result).toBe(42)
  })

  it("propagates errors", async () => {
    await expect(throttledMlFetch(() => Promise.reject(new Error("fail")))).rejects.toThrow("fail")
  })

  it("respects concurrency limit of 15", async () => {
    let concurrent = 0
    let maxConcurrent = 0

    const createTask = () =>
      throttledMlFetch(async () => {
        concurrent++
        maxConcurrent = Math.max(maxConcurrent, concurrent)
        await new Promise((r) => setTimeout(r, 150))
        concurrent--
        return true
      })

    vi.useRealTimers()
    const tasks = Array.from({ length: 25 }, () => createTask())
    await Promise.all(tasks)
    expect(maxConcurrent).toBeLessThanOrEqual(15)
  })

  it("processes all queued tasks", async () => {
    vi.useRealTimers()
    const results: number[] = []
    const tasks = Array.from({ length: 5 }, (_, i) =>
      throttledMlFetch(async () => {
        results.push(i)
        return i
      }),
    )
    const resolved = await Promise.all(tasks)
    expect(resolved).toEqual([0, 1, 2, 3, 4])
    expect(results).toHaveLength(5)
  })
})

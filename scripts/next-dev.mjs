/**
 * Next 16 defaults to Turbopack. On Windows, Turbopack + Tailwind/PostCSS can try to open
 * the reserved device path `...\\nul` and panic (os error 1). Use webpack for win32 dev.
 */
import { spawn } from "node:child_process"
import process from "node:process"

const args = ["next", "dev"]
if (process.platform === "win32") {
  args.push("--webpack")
}

const child = spawn("npx", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})

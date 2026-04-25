import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { zipSync } from "fflate"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, "..")
const extensionRoot = path.join(projectRoot, "extensions", "branch-hunter")

/** @param {string} currentDir @param {Record<string, Uint8Array>} out */
async function collectFiles(currentDir, out) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true })
  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name)
    if (entry.isDirectory()) {
      await collectFiles(absolutePath, out)
    } else {
      const rel = path.relative(extensionRoot, absolutePath).replace(/\\/g, "/")
      const key = `branch-hunter/${rel}`
      out[key] = new Uint8Array(await fs.readFile(absolutePath))
    }
  }
}

const zipFiles = {}
await collectFiles(extensionRoot, zipFiles)
const outPath = path.join(
  projectRoot,
  "extensions",
  "branch-hunter-extension-" + new Date().toISOString().slice(0, 10) + ".zip",
)
const z = zipSync(zipFiles, { level: 6 })
await fs.writeFile(outPath, z)
console.log("Written:", outPath, "(" + (z.length / 1024).toFixed(1) + " KB)")

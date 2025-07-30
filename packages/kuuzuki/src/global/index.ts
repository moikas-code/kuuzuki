import fs from "fs/promises"
import { xdgData, xdgCache, xdgConfig, xdgState } from "xdg-basedir"
import path from "path"

const app = "kuuzuki"

const data = path.join(xdgData!, app)
const cache = path.join(xdgCache!, app)
const config = path.join(xdgConfig!, app)
const state = path.join(xdgState!, app)

export namespace Global {
  export const Path = {
    data,
    bin: path.join(data, "bin"),
    cache,
    config,
    state,
  } as const
}

// Initialize directories when first accessed
let initialized = false
async function ensureInitialized() {
  if (initialized) return
  initialized = true
  

  
  await Promise.all([
    fs.mkdir(Global.Path.data, { recursive: true }),
    fs.mkdir(Global.Path.config, { recursive: true }),
    fs.mkdir(Global.Path.state, { recursive: true }),
  ])

  const CACHE_VERSION = "3"

  const version = await Bun.file(path.join(Global.Path.cache, "version"))
    .text()
    .catch(() => "0")

  if (version !== CACHE_VERSION) {
    await fs.rm(Global.Path.cache, { recursive: true, force: true })
    await Bun.file(path.join(Global.Path.cache, "version")).write(CACHE_VERSION)
  }
}

// Export initialization function
export { ensureInitialized }

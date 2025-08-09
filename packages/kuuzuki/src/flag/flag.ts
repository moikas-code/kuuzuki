export namespace Flag {
  export const KUUZUKI_AUTO_SHARE = truthy("KUUZUKI_AUTO_SHARE")
  export const KUUZUKI_DISABLE_WATCHER = truthy("KUUZUKI_DISABLE_WATCHER")
  export const KUUZUKI_CONFIG = process.env["KUUZUKI_CONFIG"]

  function truthy(key: string) {
    const value = process.env[key]?.toLowerCase()
    return value === "true" || value === "1"
  }

  export function boolean(key: string, defaultValue: boolean = false): boolean {
    const value = process.env[key]?.toLowerCase()
    if (value === "true" || value === "1") return true
    if (value === "false" || value === "0") return false
    return defaultValue
  }
}

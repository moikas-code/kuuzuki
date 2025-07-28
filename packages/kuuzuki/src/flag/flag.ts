export namespace Flag {
  export const KUUZUKI_AUTO_SHARE = truthy("KUUZUKI_AUTO_SHARE")
  export const KUUZUKI_DISABLE_WATCHER = truthy("KUUZUKI_DISABLE_WATCHER")

  function truthy(key: string) {
    const value = process.env[key]?.toLowerCase()
    return value === "true" || value === "1"
  }
}

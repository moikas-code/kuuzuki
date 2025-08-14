export namespace Flag {
  export const KUUZUKI_AUTO_SHARE = truthy("KUUZUKI_AUTO_SHARE")
  export const KUUZUKI_DISABLE_WATCHER = truthy("KUUZUKI_DISABLE_WATCHER")
  
  // Dynamic getters for environment variables to support testing
  export function getKuuzukiConfig() { return process.env["KUUZUKI_CONFIG"] }
  export function getOpencode() { return process.env["OPENCODE"] }
  export function getOpencodeDisableAutoupdate() { return truthy("OPENCODE_DISABLE_AUTOUPDATE") }
  export function getOpencodeConfig() { return process.env["OPENCODE_CONFIG"] }
  export function getOpencodePermission() { return process.env["OPENCODE_PERMISSION"] }
  
  // Backward compatibility properties
  export const KUUZUKI_CONFIG = getKuuzukiConfig()
  export const OPENCODE = getOpencode()
  export const OPENCODE_DISABLE_AUTOUPDATE = getOpencodeDisableAutoupdate()
  export const OPENCODE_CONFIG = getOpencodeConfig()
  export const OPENCODE_PERMISSION = getOpencodePermission()

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

  // Enhanced configuration discovery with OpenCode compatibility
  export function getConfigPath(): string | undefined {
    // Priority order: KUUZUKI_CONFIG, OPENCODE_CONFIG, OPENCODE
    return KUUZUKI_CONFIG || OPENCODE_CONFIG || OPENCODE
  }

  // Check if autoupdate should be disabled
  export function isAutoupdateDisabled(): boolean {
    return OPENCODE_DISABLE_AUTOUPDATE || boolean("KUUZUKI_DISABLE_AUTOUPDATE")
  }
}

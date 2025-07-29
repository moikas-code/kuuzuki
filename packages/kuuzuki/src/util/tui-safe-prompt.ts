import * as clack from "@clack/prompts"
import { Log } from "./log.js"

/**
 * TUI-Safe Prompt Wrapper
 *
 * This utility wraps @clack/prompts to prevent terminal corruption when running in TUI mode.
 * When KUUZUKI_TUI_MODE is set, it returns default values instead of showing prompts
 * that would interfere with the TUI display.
 *
 * TODO: In version 0.2.0, replace this with proper inline TUI dialogs
 */

export const isTuiMode = () => process.env["KUUZUKI_TUI_MODE"] === "true"

/**
 * TUI-safe confirm prompt
 * In TUI mode: returns false (deny by default for safety)
 * In CLI mode: shows normal confirm prompt
 */
export async function confirm(options: { message: string; initialValue?: boolean }): Promise<boolean> {
  if (isTuiMode()) {
    Log.Default.debug("tui-safe-prompt", {
      action: "confirm",
      message: options.message,
      defaulting: false,
      reason: "TUI mode active",
    })
    return false // Deny by default for safety
  }

  const result = await clack.confirm(options)
  return result as boolean
}

/**
 * TUI-safe select prompt
 * In TUI mode: returns first option
 * In CLI mode: shows normal select prompt
 */
export async function select<T extends string>(options: {
  message: string
  options: Array<{ value: T; label: string }>
  initialValue?: T
}): Promise<T> {
  if (isTuiMode()) {
    const defaultValue = options.initialValue || options.options[0]?.value
    Log.Default.debug("tui-safe-prompt", {
      action: "select",
      message: options.message,
      defaulting: defaultValue,
      reason: "TUI mode active",
    })
    return defaultValue
  }

  const result = await clack.select({
    message: options.message,
    options: options.options as any,
  })
  return result as T
}

/**
 * TUI-safe text prompt
 * In TUI mode: returns empty string
 * In CLI mode: shows normal text prompt
 */
export async function text(options: {
  message: string
  placeholder?: string
  defaultValue?: string
  validate?: (value: string) => string | void
}): Promise<string> {
  if (isTuiMode()) {
    const defaultValue = options.defaultValue || ""
    Log.Default.debug("tui-safe-prompt", {
      action: "text",
      message: options.message,
      defaulting: defaultValue,
      reason: "TUI mode active",
    })
    return defaultValue
  }

  const result = await clack.text({
    message: options.message,
    placeholder: options.placeholder,
    defaultValue: options.defaultValue,
    validate: options.validate as any,
  })
  return result as string
}

/**
 * TUI-safe password prompt
 * In TUI mode: returns empty string
 * In CLI mode: shows normal password prompt
 */
export async function password(options: {
  message: string
  validate?: (value: string) => string | void
}): Promise<string> {
  if (isTuiMode()) {
    Log.Default.debug("tui-safe-prompt", {
      action: "password",
      message: options.message,
      defaulting: "",
      reason: "TUI mode active",
    })
    return ""
  }

  const result = await clack.password({
    message: options.message,
    validate: options.validate as any,
  })
  return result as string
}

/**
 * TUI-safe multiselect prompt
 * In TUI mode: returns empty array
 * In CLI mode: shows normal multiselect prompt
 */
export async function multiselect<T extends string>(options: {
  message: string
  options: Array<{ value: T; label: string }>
  initialValues?: T[]
}): Promise<T[]> {
  if (isTuiMode()) {
    const defaultValue = options.initialValues || []
    Log.Default.debug("tui-safe-prompt", {
      action: "multiselect",
      message: options.message,
      defaulting: defaultValue,
      reason: "TUI mode active",
    })
    return defaultValue
  }

  const result = await clack.multiselect({
    message: options.message,
    options: options.options as any,
    initialValues: options.initialValues,
  })
  return result as T[]
}

/**
 * Log a message that would normally be shown via console.log
 * In TUI mode: uses the logger
 * In CLI mode: uses console.log
 */
export function logMessage(message: string) {
  if (isTuiMode()) {
    Log.Default.info("tui-safe-output", { message })
  } else {
    console.log(message)
  }
}

/**
 * Log an error that would normally be shown via console.error
 * In TUI mode: uses the logger
 * In CLI mode: uses console.error
 */
export function logError(message: string) {
  if (isTuiMode()) {
    Log.Default.error("tui-safe-output", { message })
  } else {
    console.error(message)
  }
}

// Re-export other clack utilities that don't interfere with TUI
export { spinner, intro, outro, cancel, note, isCancel } from "@clack/prompts"

// Log object that matches clack's log interface
export const log = {
  info: (message: string) => {
    if (isTuiMode()) {
      Log.Default.info("tui-safe-output", { message })
    } else {
      clack.log.info(message)
    }
  },

  success: (message: string) => {
    if (isTuiMode()) {
      Log.Default.info("tui-safe-output", { message, level: "success" })
    } else {
      clack.log.success(message)
    }
  },

  error: (message: string) => {
    if (isTuiMode()) {
      Log.Default.error("tui-safe-output", { message })
    } else {
      clack.log.error(message)
    }
  },

  warn: (message: string) => {
    if (isTuiMode()) {
      Log.Default.warn("tui-safe-output", { message })
    } else {
      clack.log.warning(message)
    }
  },

  warning: (message: string) => {
    if (isTuiMode()) {
      Log.Default.warn("tui-safe-output", { message })
    } else {
      clack.log.warning(message)
    }
  },
}

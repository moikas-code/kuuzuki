import { Log } from "../util/log"
import { SessionPersistence } from "./persistence"
import { Session } from "./index"
import { Bus } from "../bus"

/**
 * Session Integration
 *
 * Integrates the session persistence system with the existing session handling.
 * This file provides hooks and event listeners to automatically save and restore sessions.
 */
export namespace SessionIntegration {
  const log = Log.create({ service: "session-integration" })

  let initialized = false

  /**
   * Initialize session integration
   */
  export async function initialize(): Promise<void> {
    if (initialized) {
      return
    }

    try {
      log.info("Initializing session integration")

      // Set up event listeners for automatic persistence
      setupEventListeners()

      initialized = true
      log.info("Session integration initialized")
    } catch (error) {
      log.error("Failed to initialize session integration", { error })
      throw error
    }
  }

  /**
   * Set up event listeners for automatic session persistence
   */
  function setupEventListeners(): void {
    // Listen for session updates and save automatically
    Bus.subscribe(Session.Event.Updated, async (data) => {
      try {
        await SessionPersistence.saveSession(data.properties.info.id)
        log.debug("Session automatically saved after update", { sessionID: data.properties.info.id })
      } catch (error) {
        log.error("Failed to auto-save session after update", {
          sessionID: data.properties.info.id,
          error,
        })
      }
    })

    // Listen for session deletions and clean up persistence
    Bus.subscribe(Session.Event.Deleted, async (data) => {
      try {
        await SessionPersistence.deleteSession(data.properties.info.id)
        log.debug("Session persistence cleaned up after deletion", { sessionID: data.properties.info.id })
      } catch (error) {
        log.error("Failed to clean up session persistence after deletion", {
          sessionID: data.properties.info.id,
          error,
        })
      }
    })

    // Listen for session idle events for logging
    Bus.subscribe(Session.Event.Idle, async (data) => {
      try {
        // Basic idle session logging - session management is handled elsewhere
        log.debug("Session idle event received", {
          sessionID: data.properties.sessionID,
          timestamp: new Date().toISOString(),
        })
      } catch (error) {
        log.error("Failed to handle session idle event", {
          sessionID: data.properties.sessionID,
          error,
        })
      }
    })

    log.debug("Session integration event listeners set up")
  }

  /**
   * Enhanced session creation with persistence
   */
  export async function createSession(options?: {
    parentID?: string
    title?: string
    autoSave?: boolean
  }): Promise<Session.Info> {
    await initialize()

    try {
      // Create session using the base Session module
      const sessionInfo = await Session.create(options?.parentID)

      // Update title if provided
      if (options?.title) {
        await Session.update(sessionInfo.id, (draft) => {
          draft.title = options.title!
        })
      }

      // Auto-save if requested
      if (options?.autoSave !== false) {
        await SessionPersistence.saveSession(sessionInfo.id)
      }

      return sessionInfo
    } catch (error) {
      log.error("Failed to create enhanced session", { error, options })
      throw error
    }
  }

  /**
   * Enhanced session restoration that uses persistence
   */
  export async function restoreSession(sessionID: string): Promise<Session.Info> {
    await initialize()

    try {
      // Get the session info
      const sessionInfo = await Session.get(sessionID)

      // Try to restore from persistence if available
      try {
        await SessionPersistence.restoreSession(sessionID)
      } catch (error) {
        log.warn("Could not restore from persistence, using existing session", { sessionID, error })
      }

      log.info("Session restored", { sessionID })
      return sessionInfo
    } catch (error) {
      log.error("Failed to restore session", { sessionID, error })
      throw error
    }
  }

  /**
   * Enhanced session sharing with persistence
   */
  export async function shareSession(sessionID: string): Promise<{ url: string; secret: string }> {
    await initialize()
    
    try {
      // Use the base Session sharing functionality
      const shareInfo = await Session.share(sessionID)
      
      // Save session state to persistence for sharing
      await SessionPersistence.saveSession(sessionID)
      
      return shareInfo as { url: string; secret: string }    } catch (error) {
      log.error("Failed to share session", { sessionID, error })
      throw error
    }
  }

  /**
   * Enhanced session cleanup with persistence
   */
  export async function cleanupSession(sessionID: string): Promise<void> {
    await initialize()

    try {
      // Remove from persistence
      await SessionPersistence.deleteSession(sessionID)

      // Remove from the Session system
      await Session.remove(sessionID)

      log.info("Session cleaned up", { sessionID })
    } catch (error) {
      log.error("Failed to cleanup session", { sessionID, error })
      throw error
    }
  }

  /**
   * Get session statistics
   */
  export async function getSessionStatistics(): Promise<{
    sessions: {
      total: number
      active: number
    }
    persistence: Awaited<ReturnType<typeof SessionPersistence.getStatistics>>
  }> {
    await initialize()

    try {
      const persistenceStats = await SessionPersistence.getStatistics()
      
      // Count sessions manually
      let total = 0
      for await (const _ of Session.list()) {
        total++
      }

      return {
        sessions: {
          total,
          active: total, // All loaded sessions are considered active for basic implementation
        },
        persistence: persistenceStats,
      }
    } catch (error) {
      log.error("Failed to get session statistics", { error })
      throw error
    }
  }

  /**
   * Force save all active sessions
   */
  export async function saveAllSessions(): Promise<void> {
    await initialize()

    try {
      // Save all sessions to persistence
      for await (const session of Session.list()) {
        try {
          await SessionPersistence.saveSession(session.id)
        } catch (error) {
          log.error("Failed to save session", { sessionID: session.id, error })
        }
      }
      log.info("All sessions saved")
    } catch (error) {
      log.error("Failed to save all sessions", { error })
      throw error
    }
  }

  /**
   * Shutdown session integration gracefully
   */
  export async function shutdown(): Promise<void> {
    if (!initialized) {
      return
    }

    try {
      log.info("Shutting down session integration")

      // Save all sessions before shutdown
      await saveAllSessions()

      initialized = false
      log.info("Session integration shutdown complete")
    } catch (error) {
      log.error("Session integration shutdown failed", { error })
      throw error
    }
  }

  /**
   * Health check for session integration
   */
  export async function healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy"
    details: {
      initialized: boolean
      activeSessions: number
      persistenceEnabled: boolean
      errors: string[]
    }
  }> {
    const errors: string[] = []
    let status: "healthy" | "degraded" | "unhealthy" = "healthy"

    try {
      if (!initialized) {
        await initialize()
      }

      // Count active sessions
      let activeSessions = 0
      try {
        for await (const _ of Session.list()) {
          activeSessions++
        }
      } catch (error) {
        errors.push(`Session listing error: ${error}`)
        status = "degraded"
      }

      // Check persistence health
      let persistenceEnabled = false
      try {
        await SessionPersistence.getStatistics()
        persistenceEnabled = true
      } catch (error) {
        errors.push(`Persistence error: ${error}`)
        status = "degraded"
      }

      // Check for issues
      if (activeSessions > 100) {
        errors.push("High number of active sessions")
        status = "degraded"
      }

      if (errors.length > 2) {
        status = "unhealthy"
      }

      return {
        status,
        details: {
          initialized,
          activeSessions,
          persistenceEnabled,
          errors,
        },
      }
    } catch (error) {
      return {
        status: "unhealthy",
        details: {
          initialized: false,
          activeSessions: 0,
          persistenceEnabled: false,
          errors: [`Health check failed: ${error}`],
        },
      }
    }
  }

  /**
   * Migration utility to migrate existing sessions to the persistence system
   */
  export async function migrateExistingSessions(): Promise<{
    migrated: number
    failed: number
    errors: Array<{ sessionID: string; error: string }>
  }> {
    await initialize()

    let migrated = 0
    let failed = 0
    const errors: Array<{ sessionID: string; error: string }> = []

    try {
      log.info("Starting session migration")

      // Get all existing sessions
      const sessions = []
      for await (const session of Session.list()) {
        sessions.push(session)
      }

      log.info("Found sessions to migrate", { count: sessions.length })

      // Migrate each session
      for (const session of sessions) {
        try {
          // Force save to persistence
          await SessionPersistence.saveSession(session.id, { force: true })

          migrated++
          log.debug("Session migrated", { sessionID: session.id })
        } catch (error) {
          failed++
          const errorMessage = error instanceof Error ? error.message : String(error)
          errors.push({ sessionID: session.id, error: errorMessage })
          log.error("Failed to migrate session", { sessionID: session.id, error })
        }
      }

      log.info("Session migration completed", { migrated, failed, errors: errors.length })

      return { migrated, failed, errors }
    } catch (error) {
      log.error("Session migration failed", { error })
      throw error
    }
  }
}

// Export for easier importing
export const Integration = SessionIntegration

import { Log } from "../util/log"
import { SessionManager } from "./manager"
import { SessionPersistence } from "./persistence"
import { Session } from "./index"
import { Bus } from "../bus"

/**
 * Session Integration
 *
 * Integrates the new session persistence system with the existing session handling.
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

      // Initialize the session manager
      await SessionManager.initialize()

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
        await SessionPersistence.saveSession(data.info.id)
        log.debug("Session automatically saved after update", { sessionID: data.info.id })
      } catch (error) {
        log.error("Failed to auto-save session after update", {
          sessionID: data.info.id,
          error,
        })
      }
    })

    // Listen for session deletions and clean up persistence
    Bus.subscribe(Session.Event.Deleted, async (data) => {
      try {
        await SessionPersistence.deleteSession(data.info.id)
        log.debug("Session persistence cleaned up after deletion", { sessionID: data.info.id })
      } catch (error) {
        log.error("Failed to clean up session persistence after deletion", {
          sessionID: data.info.id,
          error,
        })
      }
    })

    // Listen for session idle events and potentially deactivate
    Bus.subscribe(Session.Event.Idle, async (data) => {
      try {
        // Check if session should be deactivated due to inactivity
        const activeSession = SessionManager.getActiveSession(data.sessionID)
        if (activeSession) {
          const now = Date.now()
          const inactiveTime = now - activeSession.lastAccessed

          // Deactivate if inactive for more than 1 hour
          if (inactiveTime > 60 * 60 * 1000) {
            await SessionManager.deactivateSession(data.sessionID, "timeout")
            log.debug("Session deactivated due to inactivity", {
              sessionID: data.sessionID,
              inactiveTime: Math.round(inactiveTime / 1000) + "s",
            })
          }
        }
      } catch (error) {
        log.error("Failed to handle session idle event", {
          sessionID: data.sessionID,
          error,
        })
      }
    })

    // Listen for session deletions and clean up persistence
    Bus.subscribe(Session.Event.Deleted, async (event) => {
      try {
        await SessionPersistence.deleteSession(event.info.id)
        log.debug("Session persistence cleaned up after deletion", { sessionID: event.info.id })
      } catch (error) {
        log.error("Failed to clean up session persistence after deletion", {
          sessionID: event.info.id,
          error,
        })
      }
    })

    // Listen for session idle events and potentially deactivate
    Bus.subscribe(Session.Event.Idle, async (event) => {
      try {
        // Check if session should be deactivated due to inactivity
        const activeSession = SessionManager.getActiveSession(event.sessionID)
        if (activeSession) {
          const now = Date.now()
          const inactiveTime = now - activeSession.lastAccessed

          // Deactivate if inactive for more than 1 hour
          if (inactiveTime > 60 * 60 * 1000) {
            await SessionManager.deactivateSession(event.sessionID, "timeout")
            log.debug("Session deactivated due to inactivity", {
              sessionID: event.sessionID,
              inactiveTime: Math.round(inactiveTime / 1000) + "s",
            })
          }
        }
      } catch (error) {
        log.error("Failed to handle session idle event", {
          sessionID: event.sessionID,
          error,
        })
      }
    })

    log.debug("Session integration event listeners set up")
  }

  /**
   * Enhanced session creation that uses the new manager
   */
  export async function createSession(options?: {
    parentID?: string
    title?: string
    autoSave?: boolean
    activateImmediately?: boolean
  }): Promise<Session.Info> {
    await initialize()

    try {
      // Create session using the manager
      const sessionInfo = await SessionManager.createSession({
        parentID: options?.parentID,
        title: options?.title,
        autoSave: options?.autoSave,
      })

      // Activate immediately if requested
      if (options?.activateImmediately !== false) {
        await SessionManager.activateSession(sessionInfo.id)
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
      // Activate the session (this will restore from persistence if available)
      const sessionInfo = await SessionManager.activateSession(sessionID)

      log.info("Session restored", { sessionID })
      return sessionInfo
    } catch (error) {
      log.error("Failed to restore session", { sessionID, error })
      throw error
    }
  }

  /**
   * Enhanced session sharing with manager integration
   */
  export async function shareSession(sessionID: string): Promise<{ url: string; secret: string }> {
    await initialize()

    try {
      return await SessionManager.shareSession(sessionID)
    } catch (error) {
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
      // Deactivate the session
      await SessionManager.deactivateSession(sessionID, "manual")

      // Remove from the original Session system
      await Session.remove(sessionID)

      log.info("Session cleaned up", { sessionID })
    } catch (error) {
      log.error("Failed to cleanup session", { sessionID, error })
      throw error
    }
  }

  /**
   * Get comprehensive session statistics
   */
  export async function getSessionStatistics(): Promise<{
    manager: Awaited<ReturnType<typeof SessionManager.getStatistics>>
    persistence: Awaited<ReturnType<typeof SessionPersistence.getStatistics>>
  }> {
    await initialize()

    try {
      const [managerStats, persistenceStats] = await Promise.all([
        SessionManager.getStatistics(),
        SessionPersistence.getStatistics(),
      ])

      return {
        manager: managerStats,
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
      await SessionManager.saveAllSessions()
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

      // Shutdown the session manager
      await SessionManager.shutdown()

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

      // Check manager health
      const stats = await SessionManager.getStatistics()

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
      if (stats.activeSessions > 100) {
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
          activeSessions: stats.activeSessions,
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
   * Migration utility to migrate existing sessions to the new system
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
          // Activate the session to trigger persistence
          await SessionManager.activateSession(session.id)

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

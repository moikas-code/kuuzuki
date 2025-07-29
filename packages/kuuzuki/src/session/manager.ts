import { Log } from "../util/log"
import { SessionPersistence } from "./persistence"
import { Session } from "./index"
import { Config } from "../config/config"
import { z } from "zod"
import { App } from "../app/app"
import { Bus } from "../bus"
import { HybridContextManager } from "./hybrid-context-manager"
import { HybridContextConfig } from "./hybrid-context-config"

/**
 * Session Manager
 *
 * Manages session lifecycle, sharing capabilities, and restoration on startup.
 * Integrates with the persistence system and hybrid context management.
 */
export namespace SessionManager {
  const log = Log.create({ service: "session-manager" })

  // Manager configuration
  export const ManagerConfig = z.object({
    persistenceEnabled: z.boolean().default(true),
    autoRestore: z.boolean().default(true),
    shareEnabled: z.boolean().default(true),
    hybridContextEnabled: z.boolean().default(true),
    maxActiveSessions: z.number().default(50),
    sessionTimeout: z.number().default(24 * 60 * 60 * 1000), // 24 hours
    autoSaveInterval: z.number().default(30000), // 30 seconds
  })
  export type ManagerConfig = z.infer<typeof ManagerConfig>

  // Session lifecycle events
  export const Event = {
    SessionCreated: Bus.event(
      "session.manager.created",
      z.object({
        sessionID: z.string(),
        parentID: z.string().optional(),
        restored: z.boolean(),
      }),
    ),
    SessionActivated: Bus.event(
      "session.manager.activated",
      z.object({
        sessionID: z.string(),
        lastAccessed: z.number(),
      }),
    ),
    SessionDeactivated: Bus.event(
      "session.manager.deactivated",
      z.object({
        sessionID: z.string(),
        reason: z.enum(["timeout", "manual", "cleanup"]),
      }),
    ),
    SessionShared: Bus.event(
      "session.manager.shared",
      z.object({
        sessionID: z.string(),
        shareUrl: z.string(),
      }),
    ),
    SessionUnshared: Bus.event(
      "session.manager.unshared",
      z.object({
        sessionID: z.string(),
      }),
    ),
  }

  // Manager state
  const state = App.state("session-manager", () => ({
    config: ManagerConfig.parse({}),
    activeSessions: new Map<
      string,
      {
        info: Session.Info
        lastAccessed: number
        hybridContext?: HybridContextManager
        autoSaveTimer?: NodeJS.Timeout
      }
    >(),
    initializationPromise: null as Promise<void> | null,
  }))

  /**
   * Initialize the session manager
   */
  export async function initialize(): Promise<void> {
    const s = state()

    if (s.initializationPromise) {
      return s.initializationPromise
    }

    s.initializationPromise = (async () => {
      try {
        log.info("Initializing session manager")

        // Load configuration
        s.config = await getManagerConfig()

        // Initialize persistence system
        if (s.config.persistenceEnabled) {
          await SessionPersistence.initialize()
        }

        // Restore active sessions if enabled
        if (s.config.autoRestore) {
          await restoreActiveSessions()
        }

        // Set up cleanup interval
        setInterval(async () => {
          try {
            await cleanupInactiveSessions()
          } catch (error) {
            log.error("Session cleanup failed", { error })
          }
        }, 60000) // Check every minute

        log.info("Session manager initialized", {
          persistenceEnabled: s.config.persistenceEnabled,
          autoRestore: s.config.autoRestore,
          activeSessions: s.activeSessions.size,
        })
      } catch (error) {
        log.error("Failed to initialize session manager", { error })
        throw error
      }
    })()

    return s.initializationPromise
  }

  /**
   * Create a new session with optional parent
   */
  export async function createSession(options?: {
    parentID?: string
    title?: string
    autoSave?: boolean
  }): Promise<Session.Info> {
    await initialize()

    try {
      log.debug("Creating new session", { options })

      // Create the session using the existing Session system
      const sessionInfo = await Session.create(options?.parentID)

      // Update title if provided
      if (options?.title) {
        await Session.update(sessionInfo.id, (draft) => {
          draft.title = options.title!
        })
      }

      // Add to active sessions
      const s = state()
      s.activeSessions.set(sessionInfo.id, {
        info: sessionInfo,
        lastAccessed: Date.now(),
      })

      // Set up auto-save if enabled
      if (options?.autoSave ?? s.config.persistenceEnabled) {
        scheduleAutoSave(sessionInfo.id)
      }

      // Initialize hybrid context if enabled
      if (s.config.hybridContextEnabled && HybridContextConfig.isEnabled()) {
        try {
          const hybridContext = await HybridContextManager.forSession(sessionInfo.id)
          const activeSession = s.activeSessions.get(sessionInfo.id)
          if (activeSession) {
            activeSession.hybridContext = hybridContext
          }
        } catch (error) {
          log.warn("Failed to initialize hybrid context for session", {
            sessionID: sessionInfo.id,
            error,
          })
        }
      }

      Bus.publish(Event.SessionCreated, {
        sessionID: sessionInfo.id,
        parentID: options?.parentID,
        restored: false,
      })

      log.info("Session created", { sessionID: sessionInfo.id, parentID: options?.parentID })
      return sessionInfo
    } catch (error) {
      log.error("Failed to create session", { error, options })
      throw error
    }
  }

  /**
   * Activate an existing session
   */
  export async function activateSession(sessionID: string): Promise<Session.Info> {
    await initialize()

    try {
      const s = state()

      // Check if already active
      let activeSession = s.activeSessions.get(sessionID)
      if (activeSession) {
        activeSession.lastAccessed = Date.now()
        Bus.publish(Event.SessionActivated, {
          sessionID,
          lastAccessed: activeSession.lastAccessed,
        })
        return activeSession.info
      }

      // Load session info
      const sessionInfo = await Session.get(sessionID)

      // Try to restore from persistence
      let restored = false
      if (s.config.persistenceEnabled) {
        try {
          const persistedState = await SessionPersistence.restoreSession(sessionID)
          if (persistedState) {
            restored = true
            log.debug("Session restored from persistence", { sessionID })
          }
        } catch (error) {
          log.warn("Failed to restore session from persistence", { sessionID, error })
        }
      }

      // Add to active sessions
      activeSession = {
        info: sessionInfo,
        lastAccessed: Date.now(),
      }
      s.activeSessions.set(sessionID, activeSession)

      // Initialize hybrid context if enabled
      if (s.config.hybridContextEnabled && HybridContextConfig.isEnabled()) {
        try {
          const hybridContext = await HybridContextManager.forSession(sessionID)
          activeSession.hybridContext = hybridContext
        } catch (error) {
          log.warn("Failed to initialize hybrid context for session", { sessionID, error })
        }
      }

      // Set up auto-save
      if (s.config.persistenceEnabled) {
        scheduleAutoSave(sessionID)
      }

      Bus.publish(Event.SessionActivated, {
        sessionID,
        lastAccessed: activeSession.lastAccessed,
      })

      log.debug("Session activated", { sessionID, restored })
      return sessionInfo
    } catch (error) {
      log.error("Failed to activate session", { sessionID, error })
      throw error
    }
  }

  /**
   * Deactivate a session
   */
  export async function deactivateSession(
    sessionID: string,
    reason: "timeout" | "manual" | "cleanup" = "manual",
  ): Promise<void> {
    try {
      const s = state()
      const activeSession = s.activeSessions.get(sessionID)

      if (!activeSession) {
        log.debug("Session not active, skipping deactivation", { sessionID })
        return
      }

      // Save session state if persistence is enabled
      if (s.config.persistenceEnabled) {
        try {
          await SessionPersistence.saveSession(sessionID, { force: true })
        } catch (error) {
          log.error("Failed to save session during deactivation", { sessionID, error })
        }
      }

      // Clear auto-save timer
      if (activeSession.autoSaveTimer) {
        clearTimeout(activeSession.autoSaveTimer)
      }

      // Remove from active sessions
      s.activeSessions.delete(sessionID)

      Bus.publish(Event.SessionDeactivated, {
        sessionID,
        reason,
      })

      log.debug("Session deactivated", { sessionID, reason })
    } catch (error) {
      log.error("Failed to deactivate session", { sessionID, error })
      throw error
    }
  }

  /**
   * Share a session
   */
  export async function shareSession(sessionID: string): Promise<{ url: string; secret: string }> {
    await initialize()

    try {
      const s = state()

      if (!s.config.shareEnabled) {
        throw new Error("Session sharing is disabled")
      }

      // Activate session if not already active
      await activateSession(sessionID)

      // Share using the existing Session system
      const shareInfo = await Session.share(sessionID)

      Bus.publish(Event.SessionShared, {
        sessionID,
        shareUrl: shareInfo.url,
      })

      log.info("Session shared", { sessionID, shareUrl: shareInfo.url })
      return shareInfo
    } catch (error) {
      log.error("Failed to share session", { sessionID, error })
      throw error
    }
  }

  /**
   * Unshare a session
   */
  export async function unshareSession(sessionID: string): Promise<void> {
    try {
      // Unshare using the existing Session system
      await Session.unshare(sessionID)

      Bus.publish(Event.SessionUnshared, {
        sessionID,
      })

      log.info("Session unshared", { sessionID })
    } catch (error) {
      log.error("Failed to unshare session", { sessionID, error })
      throw error
    }
  }

  /**
   * Get active session information
   */
  export function getActiveSession(sessionID: string): {
    info: Session.Info
    lastAccessed: number
    hybridContext?: HybridContextManager
  } | null {
    const s = state()
    return s.activeSessions.get(sessionID) || null
  }

  /**
   * List all active sessions
   */
  export function getActiveSessions(): Array<{
    sessionID: string
    info: Session.Info
    lastAccessed: number
    hasHybridContext: boolean
  }> {
    const s = state()
    return Array.from(s.activeSessions.entries()).map(([sessionID, session]) => ({
      sessionID,
      info: session.info,
      lastAccessed: session.lastAccessed,
      hasHybridContext: !!session.hybridContext,
    }))
  }

  /**
   * Get session statistics
   */
  export async function getStatistics(): Promise<{
    activeSessions: number
    totalSessions: number
    persistedSessions: number
    sharedSessions: number
    hybridContextSessions: number
    averageSessionAge: number
    oldestActiveSession: number
    newestActiveSession: number
  }> {
    try {
      const s = state()
      const activeSessions = Array.from(s.activeSessions.values())
      const now = Date.now()

      // Get persistence statistics
      let persistenceStats = {
        totalSessions: 0,
        totalMessages: 0,
        totalTokens: 0,
        totalCost: 0,
        averageMessagesPerSession: 0,
        oldestSession: 0,
        newestSession: 0,
        storageSize: 0,
      }

      if (s.config.persistenceEnabled) {
        try {
          persistenceStats = await SessionPersistence.getStatistics()
        } catch (error) {
          log.warn("Failed to get persistence statistics", { error })
        }
      }

      // Count shared sessions
      let sharedSessions = 0
      for (const session of activeSessions) {
        if (session.info.share) {
          sharedSessions++
        }
      }

      // Count hybrid context sessions
      const hybridContextSessions = activeSessions.filter((s) => s.hybridContext).length

      // Calculate session ages
      const sessionAges = activeSessions.map((s) => now - s.lastAccessed)
      const averageSessionAge =
        sessionAges.length > 0 ? sessionAges.reduce((sum, age) => sum + age, 0) / sessionAges.length : 0

      const oldestActiveSession = sessionAges.length > 0 ? Math.max(...sessionAges) : 0
      const newestActiveSession = sessionAges.length > 0 ? Math.min(...sessionAges) : 0

      return {
        activeSessions: s.activeSessions.size,
        totalSessions: persistenceStats.totalSessions,
        persistedSessions: persistenceStats.totalSessions,
        sharedSessions,
        hybridContextSessions,
        averageSessionAge,
        oldestActiveSession,
        newestActiveSession,
      }
    } catch (error) {
      log.error("Failed to get session statistics", { error })
      return {
        activeSessions: 0,
        totalSessions: 0,
        persistedSessions: 0,
        sharedSessions: 0,
        hybridContextSessions: 0,
        averageSessionAge: 0,
        oldestActiveSession: 0,
        newestActiveSession: 0,
      }
    }
  }

  /**
   * Cleanup inactive sessions
   */
  async function cleanupInactiveSessions(): Promise<void> {
    try {
      const s = state()
      const now = Date.now()
      const sessionsToDeactivate: string[] = []

      // Find sessions that have exceeded the timeout
      for (const [sessionID, session] of s.activeSessions) {
        const age = now - session.lastAccessed
        if (age > s.config.sessionTimeout) {
          sessionsToDeactivate.push(sessionID)
        }
      }

      // Deactivate timed-out sessions
      for (const sessionID of sessionsToDeactivate) {
        await deactivateSession(sessionID, "timeout")
      }

      // Enforce max active sessions limit
      if (s.activeSessions.size > s.config.maxActiveSessions) {
        const sessions = Array.from(s.activeSessions.entries()).sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)

        const excessCount = s.activeSessions.size - s.config.maxActiveSessions
        const sessionsToRemove = sessions.slice(0, excessCount)

        for (const [sessionID] of sessionsToRemove) {
          await deactivateSession(sessionID, "cleanup")
        }
      }

      if (sessionsToDeactivate.length > 0) {
        log.debug("Cleaned up inactive sessions", {
          deactivated: sessionsToDeactivate.length,
          remaining: s.activeSessions.size,
        })
      }
    } catch (error) {
      log.error("Session cleanup failed", { error })
    }
  }

  /**
   * Restore active sessions on startup
   */
  async function restoreActiveSessions(): Promise<void> {
    try {
      const s = state()

      if (!s.config.persistenceEnabled) {
        log.debug("Persistence disabled, skipping session restoration")
        return
      }

      log.info("Restoring active sessions")

      // Get recently accessed sessions
      const { sessions } = await SessionPersistence.listSessions({
        limit: s.config.maxActiveSessions,
        sortBy: "lastAccessed",
        sortOrder: "desc",
      })

      let restoredCount = 0
      const now = Date.now()

      for (const session of sessions) {
        // Only restore sessions accessed within the last 24 hours
        const age = now - session.metadata.lastAccessed
        if (age < 24 * 60 * 60 * 1000) {
          try {
            await activateSession(session.sessionID)
            restoredCount++

            Bus.publish(Event.SessionCreated, {
              sessionID: session.sessionID,
              restored: true,
            })
          } catch (error) {
            log.warn("Failed to restore session", { sessionID: session.sessionID, error })
          }
        }
      }

      log.info("Active sessions restored", { restoredCount })
    } catch (error) {
      log.error("Failed to restore active sessions", { error })
    }
  }

  /**
   * Schedule auto-save for a session
   */
  function scheduleAutoSave(sessionID: string): void {
    const s = state()
    const activeSession = s.activeSessions.get(sessionID)

    if (!activeSession || !s.config.persistenceEnabled) {
      return
    }

    // Clear existing timer
    if (activeSession.autoSaveTimer) {
      clearTimeout(activeSession.autoSaveTimer)
    }

    // Schedule new save
    activeSession.autoSaveTimer = setTimeout(async () => {
      try {
        await SessionPersistence.saveSession(sessionID)

        // Schedule next save
        scheduleAutoSave(sessionID)
      } catch (error) {
        log.error("Auto-save failed", { sessionID, error })
      }
    }, s.config.autoSaveInterval)
  }

  /**
   * Get manager configuration
   */
  async function getManagerConfig(): Promise<ManagerConfig> {
    try {
      const config = await Config.get()
      return ManagerConfig.parse({
        persistenceEnabled: config.experimental?.sessionManager?.persistenceEnabled ?? true,
        autoRestore: config.experimental?.sessionManager?.autoRestore ?? true,
        shareEnabled: config.share !== "disabled",
        hybridContextEnabled: config.experimental?.sessionManager?.hybridContextEnabled ?? true,
        maxActiveSessions: config.experimental?.sessionManager?.maxActiveSessions ?? 50,
        sessionTimeout: config.experimental?.sessionManager?.sessionTimeout ?? 24 * 60 * 60 * 1000,
        autoSaveInterval: config.experimental?.sessionManager?.autoSaveInterval ?? 30000,
      })
    } catch (error) {
      log.warn("Failed to load manager config, using defaults", { error })
      return ManagerConfig.parse({})
    }
  }

  /**
   * Force save all active sessions
   */
  export async function saveAllSessions(): Promise<void> {
    const s = state()

    if (!s.config.persistenceEnabled) {
      return
    }

    const savePromises = Array.from(s.activeSessions.keys()).map((sessionID) =>
      SessionPersistence.saveSession(sessionID, { force: true }).catch((error) =>
        log.error("Failed to save session", { sessionID, error }),
      ),
    )

    await Promise.all(savePromises)
    log.info("All active sessions saved", { count: savePromises.length })
  }

  /**
   * Shutdown the session manager
   */
  export async function shutdown(): Promise<void> {
    try {
      log.info("Shutting down session manager")

      // Save all active sessions
      await saveAllSessions()

      // Deactivate all sessions
      const s = state()
      const sessionIDs = Array.from(s.activeSessions.keys())

      for (const sessionID of sessionIDs) {
        await deactivateSession(sessionID, "cleanup")
      }

      log.info("Session manager shutdown complete")
    } catch (error) {
      log.error("Session manager shutdown failed", { error })
      throw error
    }
  }
}

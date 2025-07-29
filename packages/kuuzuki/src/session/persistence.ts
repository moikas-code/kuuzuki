import { Log } from "../util/log"
import { MessageV2 } from "./message-v2"
import { Session } from "./index"
import { Config } from "../config/config"
import { z } from "zod"
import { App } from "../app/app"
import { Bus } from "../bus"
import { Installation } from "../installation"
import { Storage } from "../storage/storage"

/**
 * Session Persistence System
 *
 * Handles saving and restoring session state, conversation history,
 * and session metadata with configurable cleanup policies.
 */
export namespace SessionPersistence {
  const log = Log.create({ service: "session-persistence" })

  // Session state schema
  export const SessionState = z.object({
    sessionID: z.string(),
    info: Session.Info,
    messages: z.array(
      z.object({
        info: MessageV2.Info,
        parts: z.array(MessageV2.Part),
      }),
    ),
    metadata: z.object({
      lastAccessed: z.number(),
      messageCount: z.number(),
      totalTokens: z.number(),
      cost: z.number(),
      version: z.string(),
      compressed: z.boolean().optional(),
      tags: z.array(z.string()).optional(),
    }),
    hybridContext: z
      .object({
        semanticFacts: z.array(z.any()).optional(),
        compressedMessages: z.array(z.any()).optional(),
        metrics: z.any().optional(),
      })
      .optional(),
  })
  export type SessionState = z.infer<typeof SessionState>

  // Persistence configuration
  export const PersistenceConfig = z.object({
    enabled: z.boolean().default(true),
    autoSave: z.boolean().default(true),
    saveInterval: z.number().default(30000), // 30 seconds
    maxSessions: z.number().default(1000),
    maxAge: z.number().default(30 * 24 * 60 * 60 * 1000), // 30 days
    compressionThreshold: z.number().default(100), // messages
    cleanupInterval: z.number().default(24 * 60 * 60 * 1000), // 24 hours
  })
  export type PersistenceConfig = z.infer<typeof PersistenceConfig>

  // Events
  export const Event = {
    SessionSaved: Bus.event(
      "session.persistence.saved",
      z.object({
        sessionID: z.string(),
        messageCount: z.number(),
        compressed: z.boolean(),
      }),
    ),
    SessionRestored: Bus.event(
      "session.persistence.restored",
      z.object({
        sessionID: z.string(),
        messageCount: z.number(),
        fromCompressed: z.boolean(),
      }),
    ),
    CleanupCompleted: Bus.event(
      "session.persistence.cleanup",
      z.object({
        removedSessions: z.number(),
        freedSpace: z.number(),
      }),
    ),
  }

  // In-memory state
  const state = App.state("session-persistence", () => ({
    config: PersistenceConfig.parse({}),
    saveTimers: new Map<string, NodeJS.Timeout>(),
    cleanupTimer: null as NodeJS.Timeout | null,
  }))

  /**
   * Initialize the persistence system
   */
  export async function initialize(): Promise<void> {
    const config = await getConfig()
    const s = state()
    s.config = config

    if (config.enabled) {
      log.info("Initializing session persistence", { config })

      // Start cleanup timer
      if (s.cleanupTimer) clearInterval(s.cleanupTimer)
      s.cleanupTimer = setInterval(async () => {
        try {
          await cleanup()
        } catch (error) {
          log.error("Cleanup failed", { error })
        }
      }, config.cleanupInterval)

      // Restore active sessions on startup
      await restoreActiveSessions()
    }
  }

  /**
   * Save session state to persistent storage
   */
  export async function saveSession(
    sessionID: string,
    options?: {
      force?: boolean
      compress?: boolean
    },
  ): Promise<void> {
    const config = state().config
    if (!config.enabled && !options?.force) return

    try {
      log.debug("Saving session state", { sessionID })

      // Get session data
      const sessionInfo = await Session.get(sessionID)
      const messages = await Session.messages(sessionID)

      // Calculate metadata
      const totalTokens = messages.reduce((sum, msg) => {
        if (msg.info.role === "assistant" && "tokens" in msg.info) {
          const tokens = msg.info.tokens
          return sum + tokens.input + tokens.output + tokens.reasoning
        }
        return sum
      }, 0)

      const totalCost = messages.reduce((sum, msg) => {
        if (msg.info.role === "assistant" && "cost" in msg.info) {
          return sum + msg.info.cost
        }
        return sum
      }, 0)

      // Build session state
      const sessionState: SessionState = {
        sessionID,
        info: sessionInfo,
        messages,
        metadata: {
          lastAccessed: Date.now(),
          messageCount: messages.length,
          totalTokens,
          cost: totalCost,
          version: Installation.VERSION,
          compressed: Boolean(options?.compress || messages.length > config.compressionThreshold),
        },
      }

      // Save to storage using the existing Storage system
      await Storage.writeJSON(`session-state/${sessionID}`, sessionState)

      // Update save timer
      scheduleAutoSave(sessionID)

      Bus.publish(Event.SessionSaved, {
        sessionID,
        messageCount: messages.length,
        compressed: Boolean(sessionState.metadata.compressed),
      })

      log.debug("Session state saved", {
        sessionID,
        messageCount: messages.length,
        totalTokens,
        compressed: sessionState.metadata.compressed,
      })
    } catch (error) {
      log.error("Failed to save session state", { sessionID, error })
      throw error
    }
  }

  /**
   * Restore session state from persistent storage
   */
  export async function restoreSession(sessionID: string): Promise<SessionState | null> {
    const config = state().config
    if (!config.enabled) return null

    try {
      log.debug("Restoring session state", { sessionID })

      const sessionState = await Storage.readJSON<SessionState>(`session-state/${sessionID}`)

      if (!sessionState) {
        log.debug("No saved state found for session", { sessionID })
        return null
      }

      // Validate session state
      const validatedState = SessionState.parse(sessionState)

      // Update last accessed time
      validatedState.metadata.lastAccessed = Date.now()
      await Storage.writeJSON(`session-state/${sessionID}`, validatedState)

      Bus.publish(Event.SessionRestored, {
        sessionID,
        messageCount: validatedState.messages.length,
        fromCompressed: Boolean(validatedState.metadata.compressed),
      })

      log.debug("Session state restored", {
        sessionID,
        messageCount: validatedState.messages.length,
        fromCompressed: validatedState.metadata.compressed,
      })

      return validatedState
    } catch (error) {
      log.error("Failed to restore session state", { sessionID, error })
      return null
    }
  }

  /**
   * Get conversation history for a session
   */
  export async function getConversationHistory(
    sessionID: string,
    options?: {
      limit?: number
      offset?: number
      includeSystem?: boolean
    },
  ): Promise<{
    messages: Array<{ info: MessageV2.Info; parts: MessageV2.Part[] }>
    total: number
    hasMore: boolean
  }> {
    const sessionState = await restoreSession(sessionID)
    if (!sessionState) {
      return { messages: [], total: 0, hasMore: false }
    }

    let messages = sessionState.messages

    // Filter system messages if requested (note: MessageV2 doesn't have system role)
    if (!options?.includeSystem) {
      // Keep all messages since MessageV2 only has "user" and "assistant" roles
      // System prompts are stored in assistant message metadata
    }

    const total = messages.length
    const offset = options?.offset || 0
    const limit = options?.limit || messages.length

    // Apply pagination
    const paginatedMessages = messages.slice(offset, offset + limit)
    const hasMore = offset + limit < total

    return {
      messages: paginatedMessages,
      total,
      hasMore,
    }
  }

  /**
   * Update session metadata
   */
  export async function updateSessionMetadata(
    sessionID: string,
    updates: Partial<SessionState["metadata"]>,
  ): Promise<void> {
    try {
      const sessionState = await Storage.readJSON<SessionState>(`session-state/${sessionID}`)

      if (sessionState) {
        sessionState.metadata = { ...sessionState.metadata, ...updates }
        await Storage.writeJSON(`session-state/${sessionID}`, sessionState)
      }
    } catch (error) {
      log.error("Failed to update session metadata", { sessionID, error })
    }
  }

  /**
   * List all persisted sessions with metadata
   */
  export async function listSessions(options?: {
    limit?: number
    offset?: number
    sortBy?: "lastAccessed" | "created" | "messageCount"
    sortOrder?: "asc" | "desc"
    tags?: string[]
  }): Promise<{
    sessions: Array<{
      sessionID: string
      info: Session.Info
      metadata: SessionState["metadata"]
    }>
    total: number
    hasMore: boolean
  }> {
    try {
      const sessionKeys = await Storage.list("session-state")

      const sessions = []
      for (const key of sessionKeys) {
        try {
          const sessionState = await Storage.readJSON<SessionState>(key)
          if (sessionState) {
            // Filter by tags if specified
            if (options?.tags && options.tags.length > 0) {
              const sessionTags = sessionState.metadata.tags || []
              const hasMatchingTag = options.tags.some((tag) => sessionTags.includes(tag))
              if (!hasMatchingTag) continue
            }

            sessions.push({
              sessionID: sessionState.sessionID,
              info: sessionState.info,
              metadata: sessionState.metadata,
            })
          }
        } catch (error) {
          log.warn("Failed to load session state", { key, error })
        }
      }

      // Sort sessions
      const sortBy = options?.sortBy || "lastAccessed"
      const sortOrder = options?.sortOrder || "desc"
      sessions.sort((a, b) => {
        let aValue: number
        let bValue: number

        switch (sortBy) {
          case "lastAccessed":
            aValue = a.metadata.lastAccessed
            bValue = b.metadata.lastAccessed
            break
          case "created":
            aValue = a.info.time.created
            bValue = b.info.time.created
            break
          case "messageCount":
            aValue = a.metadata.messageCount
            bValue = b.metadata.messageCount
            break
          default:
            aValue = a.metadata.lastAccessed
            bValue = b.metadata.lastAccessed
        }

        return sortOrder === "desc" ? bValue - aValue : aValue - bValue
      })

      const total = sessions.length
      const offset = options?.offset || 0
      const limit = options?.limit || sessions.length

      const paginatedSessions = sessions.slice(offset, offset + limit)
      const hasMore = offset + limit < total

      return {
        sessions: paginatedSessions,
        total,
        hasMore,
      }
    } catch (error) {
      log.error("Failed to list sessions", { error })
      return { sessions: [], total: 0, hasMore: false }
    }
  }

  /**
   * Delete persisted session data
   */
  export async function deleteSession(sessionID: string): Promise<void> {
    try {
      await Storage.remove(`session-state/${sessionID}`)

      // Clear any pending save timer
      const s = state()
      const timer = s.saveTimers.get(sessionID)
      if (timer) {
        clearTimeout(timer)
        s.saveTimers.delete(sessionID)
      }

      log.debug("Session state deleted", { sessionID })
    } catch (error) {
      log.error("Failed to delete session state", { sessionID, error })
      throw error
    }
  }

  /**
   * Cleanup old sessions based on configuration
   */
  export async function cleanup(): Promise<{ removedSessions: number; freedSpace: number }> {
    const config = state().config
    if (!config.enabled) return { removedSessions: 0, freedSpace: 0 }

    try {
      log.info("Starting session cleanup")

      const sessionKeys = await Storage.list("session-state")

      let removedSessions = 0
      let freedSpace = 0
      const now = Date.now()

      // Get all session metadata for cleanup decisions
      const sessionMetadata = []
      for (const key of sessionKeys) {
        try {
          const sessionState = await Storage.readJSON<SessionState>(key)
          if (sessionState) {
            sessionMetadata.push({
              key,
              sessionID: sessionState.sessionID,
              lastAccessed: sessionState.metadata.lastAccessed,
              messageCount: sessionState.metadata.messageCount,
              size: JSON.stringify(sessionState).length,
            })
          }
        } catch (error) {
          log.warn("Failed to load session for cleanup", { key, error })
        }
      }

      // Sort by last accessed (oldest first)
      sessionMetadata.sort((a, b) => a.lastAccessed - b.lastAccessed)

      // Remove sessions that exceed max age
      for (const session of sessionMetadata) {
        const age = now - session.lastAccessed
        if (age > config.maxAge) {
          await Storage.remove(session.key)
          removedSessions++
          freedSpace += session.size
          log.debug("Removed old session", {
            sessionID: session.sessionID,
            age: Math.round(age / (24 * 60 * 60 * 1000)) + " days",
          })
        }
      }

      // Remove excess sessions if we exceed maxSessions
      const remainingSessions = sessionMetadata.filter((s) => now - s.lastAccessed <= config.maxAge)

      if (remainingSessions.length > config.maxSessions) {
        const excessSessions = remainingSessions.slice(0, remainingSessions.length - config.maxSessions)
        for (const session of excessSessions) {
          await Storage.remove(session.key)
          removedSessions++
          freedSpace += session.size
          log.debug("Removed excess session", { sessionID: session.sessionID })
        }
      }

      Bus.publish(Event.CleanupCompleted, { removedSessions, freedSpace })

      log.info("Session cleanup completed", { removedSessions, freedSpace })
      return { removedSessions, freedSpace }
    } catch (error) {
      log.error("Session cleanup failed", { error })
      return { removedSessions: 0, freedSpace: 0 }
    }
  }

  /**
   * Get persistence configuration
   */
  async function getConfig(): Promise<PersistenceConfig> {
    try {
      const config = await Config.get()
      return PersistenceConfig.parse({
        enabled: config.experimental?.sessionPersistence?.enabled ?? true,
        autoSave: config.experimental?.sessionPersistence?.autoSave ?? true,
        saveInterval: config.experimental?.sessionPersistence?.saveInterval ?? 30000,
        maxSessions: config.experimental?.sessionPersistence?.maxSessions ?? 1000,
        maxAge: config.experimental?.sessionPersistence?.maxAge ?? 30 * 24 * 60 * 60 * 1000,
        compressionThreshold: config.experimental?.sessionPersistence?.compressionThreshold ?? 100,
        cleanupInterval: config.experimental?.sessionPersistence?.cleanupInterval ?? 24 * 60 * 60 * 1000,
      })
    } catch (error) {
      log.warn("Failed to load persistence config, using defaults", { error })
      return PersistenceConfig.parse({})
    }
  }

  /**
   * Schedule auto-save for a session
   */
  function scheduleAutoSave(sessionID: string): void {
    const s = state()
    const config = s.config

    if (!config.autoSave) return

    // Clear existing timer
    const existingTimer = s.saveTimers.get(sessionID)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Schedule new save
    const timer = setTimeout(async () => {
      try {
        await saveSession(sessionID)
      } catch (error) {
        log.error("Auto-save failed", { sessionID, error })
      } finally {
        s.saveTimers.delete(sessionID)
      }
    }, config.saveInterval)

    s.saveTimers.set(sessionID, timer)
  }

  /**
   * Restore active sessions on startup
   */
  async function restoreActiveSessions(): Promise<void> {
    try {
      log.info("Restoring active sessions")

      const { sessions } = await listSessions({
        limit: 10,
        sortBy: "lastAccessed",
        sortOrder: "desc",
      })

      let restoredCount = 0
      for (const session of sessions) {
        // Only restore recently accessed sessions (within last 24 hours)
        const age = Date.now() - session.metadata.lastAccessed
        if (age < 24 * 60 * 60 * 1000) {
          try {
            await restoreSession(session.sessionID)
            restoredCount++
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
   * Export session data for backup or migration
   */
  export async function exportSession(sessionID: string): Promise<SessionState | null> {
    return restoreSession(sessionID)
  }

  /**
   * Import session data from backup or migration
   */
  export async function importSession(sessionState: SessionState): Promise<void> {
    const validatedState = SessionState.parse(sessionState)

    await Storage.writeJSON(`session-state/${validatedState.sessionID}`, validatedState)

    log.info("Session imported", { sessionID: validatedState.sessionID })
  }

  /**
   * Get session statistics
   */
  export async function getStatistics(): Promise<{
    totalSessions: number
    totalMessages: number
    totalTokens: number
    totalCost: number
    averageMessagesPerSession: number
    oldestSession: number
    newestSession: number
    storageSize: number
  }> {
    try {
      const { sessions } = await listSessions()

      const stats = sessions.reduce(
        (acc, session) => ({
          totalSessions: acc.totalSessions + 1,
          totalMessages: acc.totalMessages + session.metadata.messageCount,
          totalTokens: acc.totalTokens + session.metadata.totalTokens,
          totalCost: acc.totalCost + session.metadata.cost,
          oldestSession: Math.min(acc.oldestSession, session.info.time.created),
          newestSession: Math.max(acc.newestSession, session.info.time.created),
          storageSize: acc.storageSize + JSON.stringify(session).length,
        }),
        {
          totalSessions: 0,
          totalMessages: 0,
          totalTokens: 0,
          totalCost: 0,
          oldestSession: Date.now(),
          newestSession: 0,
          storageSize: 0,
        },
      )

      return {
        ...stats,
        averageMessagesPerSession: stats.totalSessions > 0 ? stats.totalMessages / stats.totalSessions : 0,
      }
    } catch (error) {
      log.error("Failed to get statistics", { error })
      return {
        totalSessions: 0,
        totalMessages: 0,
        totalTokens: 0,
        totalCost: 0,
        averageMessagesPerSession: 0,
        oldestSession: 0,
        newestSession: 0,
        storageSize: 0,
      }
    }
  }
}

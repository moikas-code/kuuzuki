import { Log } from "../util/log"
import { Bus } from "../bus"
import { z } from "zod"
import { KuuzukiError, ErrorCategory, ErrorSeverity } from "./types"

const log = Log.create({ service: "error-monitoring" })

// Error monitoring events
const ErrorMetricsEvent = Bus.event("error.metrics", z.object({
  category: z.string(),
  severity: z.string(),
  code: z.string(),
  count: z.number(),
  timestamp: z.number(),
}))

const ErrorPatternEvent = Bus.event("error.pattern", z.object({
  pattern: z.string(),
  frequency: z.number(),
  riskLevel: z.string(),
  timestamp: z.number(),
}))

export interface ErrorMetrics {
  totalErrors: number
  errorsByCategory: Record<ErrorCategory, number>
  errorsBySeverity: Record<ErrorSeverity, number>
  errorsByCode: Record<string, number>
  errorRate: number
  averageResolutionTime: number
  topErrors: Array<{ code: string; count: number; lastOccurred: number }>
  trends: {
    hourly: number[]
    daily: number[]
    weekly: number[]
  }
}

export interface ErrorPattern {
  pattern: string
  frequency: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  firstSeen: number
  lastSeen: number
  affectedSessions: string[]
  commonContext: Record<string, any>
}

export interface MonitoringAlert {
  id: string
  type: 'threshold' | 'pattern' | 'anomaly'
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  details: Record<string, any>
  timestamp: number
  acknowledged: boolean
}

export class ErrorMonitoring {
  private static errorHistory: Array<{
    error: KuuzukiError
    timestamp: number
    resolved: boolean
    resolutionTime?: number
  }> = []

  private static patterns: Map<string, ErrorPattern> = new Map()
  private static alerts: Map<string, MonitoringAlert> = new Map()
  
  private static readonly MAX_HISTORY_SIZE = 10000
  private static readonly PATTERN_DETECTION_WINDOW = 3600000 // 1 hour
  private static readonly ERROR_RATE_THRESHOLD = 10 // errors per minute
  private static readonly PATTERN_FREQUENCY_THRESHOLD = 5

  /**
   * Record an error occurrence
   */
  static recordError(error: KuuzukiError): void {
    const timestamp = Date.now()
    
    // Add to history
    this.errorHistory.push({
      error,
      timestamp,
      resolved: false
    })

    // Maintain history size
    if (this.errorHistory.length > this.MAX_HISTORY_SIZE) {
      this.errorHistory.shift()
    }

    // Detect patterns
    this.detectErrorPatterns(error, timestamp)

    // Check thresholds
    this.checkErrorThresholds()

    // Emit metrics event
    Bus.publish(ErrorMetricsEvent, {
      category: error.category,
      severity: error.severity,
      code: error.code,
      count: 1,
      timestamp
    })

    log.info("Error recorded for monitoring", {
      code: error.code,
      category: error.category,
      severity: error.severity,
      sessionId: error.context.sessionId
    })
  }

  /**
   * Mark an error as resolved
   */
  static markErrorResolved(errorCode: string, sessionId?: string): void {
    const timestamp = Date.now()
    
    // Find and mark matching errors as resolved
    for (const entry of this.errorHistory) {
      if (entry.error.code === errorCode && 
          !entry.resolved &&
          (!sessionId || entry.error.context.sessionId === sessionId)) {
        entry.resolved = true
        entry.resolutionTime = timestamp - entry.timestamp
        break
      }
    }

    log.info("Error marked as resolved", { errorCode, sessionId })
  }

  /**
   * Get current error metrics
   */
  static getMetrics(): ErrorMetrics {
    const now = Date.now()
    const oneHour = 60 * 60 * 1000
    const oneDay = 24 * oneHour
    const oneWeek = 7 * oneDay

    // Filter recent errors
    const recentErrors = this.errorHistory.filter(
      entry => now - entry.timestamp < oneDay
    )

    // Calculate metrics
    const totalErrors = recentErrors.length
    
    const errorsByCategory = {} as Record<ErrorCategory, number>
    const errorsBySeverity = {} as Record<ErrorSeverity, number>
    const errorsByCode = {} as Record<string, number>

    for (const entry of recentErrors) {
      const { error } = entry
      
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1
      errorsByCode[error.code] = (errorsByCode[error.code] || 0) + 1
    }

    // Calculate error rate (errors per minute)
    const errorRate = totalErrors / (oneDay / 60000)

    // Calculate average resolution time
    const resolvedErrors = recentErrors.filter(entry => entry.resolved && entry.resolutionTime)
    const averageResolutionTime = resolvedErrors.length > 0
      ? resolvedErrors.reduce((sum, entry) => sum + (entry.resolutionTime || 0), 0) / resolvedErrors.length
      : 0

    // Get top errors
    const topErrors = Object.entries(errorsByCode)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([code, count]) => {
        const lastOccurred = Math.max(
          ...recentErrors
            .filter(entry => entry.error.code === code)
            .map(entry => entry.timestamp)
        )
        return { code, count, lastOccurred }
      })

    // Calculate trends
    const trends = {
      hourly: this.calculateHourlyTrend(now, oneHour),
      daily: this.calculateDailyTrend(now, oneDay),
      weekly: this.calculateWeeklyTrend(now, oneWeek)
    }

    return {
      totalErrors,
      errorsByCategory,
      errorsBySeverity,
      errorsByCode,
      errorRate,
      averageResolutionTime,
      topErrors,
      trends
    }
  }

  /**
   * Detect error patterns
   */
  private static detectErrorPatterns(error: KuuzukiError, timestamp: number): void {
    const patternKey = `${error.category}:${error.code}`
    
    let pattern = this.patterns.get(patternKey)
    if (!pattern) {
      pattern = {
        pattern: patternKey,
        frequency: 0,
        riskLevel: 'low',
        firstSeen: timestamp,
        lastSeen: timestamp,
        affectedSessions: [],
        commonContext: {}
      }
      this.patterns.set(patternKey, pattern)
    }

    // Update pattern
    pattern.frequency++
    pattern.lastSeen = timestamp
    
    if (error.context.sessionId && !pattern.affectedSessions.includes(error.context.sessionId)) {
      pattern.affectedSessions.push(error.context.sessionId)
    }

    // Update risk level based on frequency and severity
    if (pattern.frequency >= this.PATTERN_FREQUENCY_THRESHOLD) {
      if (error.severity === ErrorSeverity.CRITICAL) {
        pattern.riskLevel = 'critical'
      } else if (error.severity === ErrorSeverity.HIGH) {
        pattern.riskLevel = 'high'
      } else if (pattern.frequency >= 10) {
        pattern.riskLevel = 'medium'
      }
    }

    // Emit pattern event if significant
    if (pattern.frequency >= this.PATTERN_FREQUENCY_THRESHOLD) {
      Bus.publish(ErrorPatternEvent, {
        pattern: patternKey,
        frequency: pattern.frequency,
        riskLevel: pattern.riskLevel,
        timestamp
      })
    }

    log.debug("Error pattern updated", {
      pattern: patternKey,
      frequency: pattern.frequency,
      riskLevel: pattern.riskLevel
    })
  }

  /**
   * Check error thresholds and generate alerts
   */
  private static checkErrorThresholds(): void {
    const now = Date.now()
    const oneMinute = 60 * 1000
    
    // Check error rate threshold
    const recentErrors = this.errorHistory.filter(
      entry => now - entry.timestamp < oneMinute
    )

    if (recentErrors.length >= this.ERROR_RATE_THRESHOLD) {
      this.createAlert({
        type: 'threshold',
        severity: 'error',
        message: `High error rate detected: ${recentErrors.length} errors in the last minute`,
        details: {
          errorCount: recentErrors.length,
          threshold: this.ERROR_RATE_THRESHOLD,
          timeWindow: oneMinute
        }
      })
    }

    // Check for critical error patterns
    for (const pattern of this.patterns.values()) {
      if (pattern.riskLevel === 'critical' && 
          now - pattern.lastSeen < oneMinute) {
        this.createAlert({
          type: 'pattern',
          severity: 'critical',
          message: `Critical error pattern detected: ${pattern.pattern}`,
          details: {
            pattern: pattern.pattern,
            frequency: pattern.frequency,
            affectedSessions: pattern.affectedSessions.length
          }
        })
      }
    }
  }

  /**
   * Create monitoring alert
   */
  private static createAlert(alertData: Omit<MonitoringAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const alert: MonitoringAlert = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      acknowledged: false,
      ...alertData
    }

    this.alerts.set(alert.id, alert)

    log.warn("Monitoring alert created", {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message
    })
  }

  /**
   * Get active alerts
   */
  static getActiveAlerts(): MonitoringAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Acknowledge alert
   */
  static acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId)
    if (alert) {
      alert.acknowledged = true
      log.info("Alert acknowledged", { alertId })
      return true
    }
    return false
  }

  /**
   * Get error patterns
   */
  static getErrorPatterns(): ErrorPattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * Generate monitoring report
   */
  static generateReport(): {
    summary: string
    metrics: ErrorMetrics
    patterns: ErrorPattern[]
    alerts: MonitoringAlert[]
    recommendations: string[]
  } {
    const metrics = this.getMetrics()
    const patterns = this.getErrorPatterns()
    const alerts = this.getActiveAlerts()
    const recommendations: string[] = []

    // Generate recommendations based on metrics
    if (metrics.errorRate > this.ERROR_RATE_THRESHOLD) {
      recommendations.push("High error rate detected - investigate recent changes")
    }

    if (metrics.errorsByCategory[ErrorCategory.NETWORK] > metrics.totalErrors * 0.3) {
      recommendations.push("High network error rate - check connectivity and API endpoints")
    }

    if (metrics.errorsByCategory[ErrorCategory.AUTH] > 0) {
      recommendations.push("Authentication errors detected - verify API keys and credentials")
    }

    const criticalPatterns = patterns.filter(p => p.riskLevel === 'critical')
    if (criticalPatterns.length > 0) {
      recommendations.push(`${criticalPatterns.length} critical error patterns detected - immediate attention required`)
    }

    if (metrics.averageResolutionTime > 300000) { // 5 minutes
      recommendations.push("High average resolution time - consider improving error handling")
    }

    const summary = `Error monitoring report: ${metrics.totalErrors} total errors, ${alerts.length} active alerts, ${patterns.length} patterns detected. Error rate: ${metrics.errorRate.toFixed(2)} errors/minute.`

    return {
      summary,
      metrics,
      patterns,
      alerts,
      recommendations
    }
  }

  /**
   * Calculate hourly trend
   */
  private static calculateHourlyTrend(now: number, oneHour: number): number[] {
    const trend: number[] = []
    
    for (let i = 23; i >= 0; i--) {
      const startTime = now - (i + 1) * oneHour
      const endTime = now - i * oneHour
      
      const count = this.errorHistory.filter(
        entry => entry.timestamp >= startTime && entry.timestamp < endTime
      ).length
      
      trend.push(count)
    }
    
    return trend
  }

  /**
   * Calculate daily trend
   */
  private static calculateDailyTrend(now: number, oneDay: number): number[] {
    const trend: number[] = []
    
    for (let i = 6; i >= 0; i--) {
      const startTime = now - (i + 1) * oneDay
      const endTime = now - i * oneDay
      
      const count = this.errorHistory.filter(
        entry => entry.timestamp >= startTime && entry.timestamp < endTime
      ).length
      
      trend.push(count)
    }
    
    return trend
  }

  /**
   * Calculate weekly trend
   */
  private static calculateWeeklyTrend(now: number, oneWeek: number): number[] {
    const trend: number[] = []
    
    for (let i = 3; i >= 0; i--) {
      const startTime = now - (i + 1) * oneWeek
      const endTime = now - i * oneWeek
      
      const count = this.errorHistory.filter(
        entry => entry.timestamp >= startTime && entry.timestamp < endTime
      ).length
      
      trend.push(count)
    }
    
    return trend
  }

  /**
   * Clear old data (for maintenance)
   */
  static clearOldData(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge
    
    // Clear old error history
    this.errorHistory = this.errorHistory.filter(
      entry => entry.timestamp > cutoff
    )

    // Clear old patterns
    for (const [key, pattern] of this.patterns.entries()) {
      if (pattern.lastSeen < cutoff) {
        this.patterns.delete(key)
      }
    }

    // Clear old acknowledged alerts
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.acknowledged && alert.timestamp < cutoff) {
        this.alerts.delete(id)
      }
    }

    log.info("Old monitoring data cleared", {
      cutoff: new Date(cutoff).toISOString(),
      remainingErrors: this.errorHistory.length,
      remainingPatterns: this.patterns.size,
      remainingAlerts: this.alerts.size
    })
  }

  /**
   * Export monitoring data for analysis
   */
  static exportData(): {
    errors: Array<any>
    patterns: Array<any>
    alerts: Array<any>
    exportTime: number
  } {
    return {
      errors: this.errorHistory.map(entry => ({
        ...entry.error.toJSON(),
        timestamp: entry.timestamp,
        resolved: entry.resolved,
        resolutionTime: entry.resolutionTime
      })),
      patterns: Array.from(this.patterns.values()),
      alerts: Array.from(this.alerts.values()),
      exportTime: Date.now()
    }
  }
}
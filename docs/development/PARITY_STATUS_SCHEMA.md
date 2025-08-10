# Parity Status Schema and Data Structure

This document defines the data structures and schemas used for tracking fork parity status.

## Database Schema

### Commits Table
```sql
CREATE TABLE commits (
  hash TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  author TEXT NOT NULL,
  commit_date TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  category TEXT,
  effort_estimate TEXT,
  conflict_risk REAL DEFAULT 0.0,
  reasoning TEXT,
  integration_notes TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE parity_metadata (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE integration_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_hash TEXT,
  old_status TEXT,
  new_status TEXT,
  notes TEXT,
  changed_by TEXT,
  changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (commit_hash) REFERENCES commits(hash)
);
```

### Status Values
- `pending` - Not yet reviewed or integrated
- `reviewed` - Analyzed but not yet integrated
- `integrated` - Successfully integrated into kuuzuki
- `enhanced` - Integrated with kuuzuki-specific improvements
- `skipped` - Intentionally not integrated
- `not_applicable` - Doesn't apply to kuuzuki
- `conflict` - Has integration conflicts
- `deferred` - Integration postponed

### Priority Values
- `critical` - Must be integrated immediately
- `high` - Should be integrated soon
- `medium` - Standard priority
- `low` - Nice to have

### Category Values
- `security` - Security-related changes
- `feature` - New features
- `bugfix` - Bug fixes
- `performance` - Performance improvements
- `refactor` - Code refactoring
- `docs` - Documentation changes
- `chore` - Maintenance tasks
- `infrastructure` - Infrastructure changes

## JSON Schema for Reports

### Parity Status Report
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "generated_at": { "type": "string", "format": "date-time" },
    "repository": {
      "type": "object",
      "properties": {
        "path": { "type": "string" },
        "upstream_url": { "type": "string" },
        "upstream_branch": { "type": "string" }
      }
    },
    "summary": {
      "type": "object",
      "properties": {
        "total_commits": { "type": "integer" },
        "integrated_count": { "type": "integer" },
        "enhanced_count": { "type": "integer" },
        "skipped_count": { "type": "integer" },
        "pending_count": { "type": "integer" },
        "critical_count": { "type": "integer" },
        "high_count": { "type": "integer" },
        "avg_conflict_risk": { "type": "number" }
      }
    },
    "commits": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "hash": { "type": "string" },
          "message": { "type": "string" },
          "author": { "type": "string" },
          "commit_date": { "type": "string", "format": "date-time" },
          "status": { "type": "string" },
          "priority": { "type": "string" },
          "category": { "type": "string" },
          "effort_estimate": { "type": "string" },
          "conflict_risk": { "type": "number" },
          "reasoning": { "type": "string" }
        }
      }
    }
  }
}
```

### Feature Comparison Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "feature_name": { "type": "string" },
    "analysis_date": { "type": "string", "format": "date-time" },
    "upstream_status": {
      "type": "object",
      "properties": {
        "implemented": { "type": "boolean" },
        "version": { "type": "string" },
        "commits": { "type": "array", "items": { "type": "string" } },
        "description": { "type": "string" }
      }
    },
    "kuuzuki_status": {
      "type": "object",
      "properties": {
        "implemented": { "type": "boolean" },
        "enhanced": { "type": "boolean" },
        "version": { "type": "string" },
        "enhancements": { "type": "array", "items": { "type": "string" } },
        "description": { "type": "string" }
      }
    },
    "parity_assessment": {
      "type": "object",
      "properties": {
        "status": { 
          "type": "string",
          "enum": ["ahead", "behind", "equal", "different"]
        },
        "recommendation": { "type": "string" },
        "integration_effort": { "type": "string" },
        "risk_level": { "type": "string" }
      }
    }
  }
}
```

## Knowledge Base Structure

### File Naming Convention
```
kb/active/
├── opencode-parity-status.md          # Current overall status
├── opencode-parity-summary.md         # Executive summary
├── parity-audit-YYYY-MM-DD.md         # Audit reports
├── feature-analysis-{feature}.md      # Feature-specific analysis
└── integration-plan-{version}.md      # Version integration plans

kb/archive/
├── parity-reports/
│   ├── YYYY/
│   │   ├── MM/
│   │   │   └── parity-report-YYYY-MM-DD.md
└── integration-history/
    ├── v{version}/
    │   ├── integration-plan.md
    │   ├── integration-report.md
    │   └── post-integration-analysis.md
```

### Markdown Template for Feature Analysis
```markdown
# Feature Analysis: {Feature Name}

## Overview
- **Feature**: {Feature Name}
- **Analysis Date**: {Date}
- **Analyst**: {Name}
- **Status**: {Status}

## Upstream Implementation
- **Commits**: {Commit hashes}
- **Description**: {What upstream implemented}
- **Files Changed**: {Key files}
- **Impact**: {Impact assessment}

## Kuuzuki Current State
- **Implementation Status**: {Implemented/Not Implemented/Enhanced}
- **Current Approach**: {How kuuzuki handles this}
- **Differences**: {Key differences from upstream}
- **Advantages**: {Kuuzuki advantages if any}

## Parity Assessment
- **Status**: {Ahead/Behind/Equal/Different}
- **Integration Needed**: {Yes/No/Partial}
- **Effort Estimate**: {Trivial/Small/Medium/Large/XL}
- **Risk Level**: {Low/Medium/High/Critical}
- **Conflicts**: {Potential conflicts}

## Recommendations
- **Action**: {Integrate/Skip/Enhance/Review}
- **Priority**: {Critical/High/Medium/Low}
- **Timeline**: {Suggested timeline}
- **Dependencies**: {Any dependencies}

## Implementation Notes
{Implementation details, decisions, etc.}

## Testing Requirements
{What needs to be tested}

## Documentation Updates
{What docs need updating}
```

## API Endpoints for Parity Data

### REST API Schema
```typescript
// GET /api/parity/status
interface ParityStatus {
  summary: {
    total_commits: number;
    by_status: Record<string, number>;
    by_priority: Record<string, number>;
    by_category: Record<string, number>;
  };
  recent_changes: Commit[];
  critical_items: Commit[];
}

// GET /api/parity/commits
interface CommitList {
  commits: Commit[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  filters: {
    status?: string;
    priority?: string;
    category?: string;
  };
}

// GET /api/parity/features/{feature}
interface FeatureAnalysis {
  feature_name: string;
  upstream_status: UpstreamStatus;
  kuuzuki_status: KuuzukiStatus;
  parity_assessment: ParityAssessment;
  related_commits: Commit[];
}
```

## Configuration Schema

### Parity Tracking Configuration
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "upstream": {
      "type": "object",
      "properties": {
        "remote_name": { "type": "string", "default": "upstream" },
        "branch": { "type": "string", "default": "dev" },
        "url": { "type": "string" }
      }
    },
    "tracking": {
      "type": "object",
      "properties": {
        "auto_sync": { "type": "boolean", "default": true },
        "sync_interval": { "type": "string", "default": "daily" },
        "alert_on_critical": { "type": "boolean", "default": true },
        "categories_to_track": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["security", "feature", "bugfix"]
        }
      }
    },
    "notifications": {
      "type": "object",
      "properties": {
        "discord_webhook": { "type": "string" },
        "slack_webhook": { "type": "string" },
        "email_notifications": { "type": "boolean", "default": false }
      }
    }
  }
}
```

This schema provides a comprehensive structure for tracking and managing fork parity status across all aspects of the kuuzuki project.
# Fork Parity Workflow Guide

This guide outlines the complete workflow for managing fork parity in the kuuzuki project.

## Overview

The kuuzuki project maintains a sophisticated parity tracking system to ensure we stay aligned with valuable upstream changes while preserving our unique enhancements and avoiding unnecessary complexity.

## Daily Workflow

### 1. Automated Monitoring
- **GitHub Actions** runs daily parity analysis at 6 AM UTC
- Generates reports in `.fork-parity-reports/`
- Updates knowledge base with current status
- Creates GitHub issues for critical items
- Sends Discord notifications (if configured)

### 2. Manual Checks
Developers can run manual parity checks anytime:

```bash
# Quick parity check
./scripts/parity-check.sh

# Stats only (faster)
./scripts/parity-check.sh --stats-only

# Skip remote fetching
./scripts/parity-check.sh --no-fetch
```

## Weekly Review Process

### 1. Review Automated Reports
```bash
# Check latest automated status
kb_read active/automated-parity-status.md

# Review recent reports
ls -la .fork-parity-reports/
```

### 2. Analyze Critical Items
```bash
# Get actionable items
fork-parity-mcp actionable --priority critical

# Generate comprehensive dashboard
fork-parity-mcp dashboard
```

### 3. Feature-Specific Analysis
For important features, create detailed analysis:

```bash
# Create feature analysis document
kb_create active/feature-analysis-{feature-name}.md
```

Use the template from `PARITY_STATUS_SCHEMA.md`.

## Integration Workflow

### Phase 1: Analysis
1. **Identify Target Commits**
   ```bash
   fork-parity-mcp analyze <commit-hash>
   ```

2. **Check Existing Implementation**
   ```bash
   # Search for similar functionality
   kb_search "authentication"
   grep -r "permission" packages/kuuzuki/src/
   ```

3. **Assess Integration Need**
   - ✅ **Already Implemented** - Mark as integrated
   - 🚀 **Enhanced in Kuuzuki** - Document advantages
   - ❌ **Missing** - Plan integration
   - 🚫 **Not Applicable** - Mark as skipped

### Phase 2: Planning
1. **Create Integration Plan**
   ```markdown
   # Integration Plan: {Feature Name}
   
   ## Target Commits
   - {commit-hash}: {description}
   
   ## Current State Analysis
   - Kuuzuki implementation: {status}
   - Differences from upstream: {differences}
   
   ## Integration Approach
   - Strategy: {integrate/enhance/skip}
   - Effort estimate: {trivial/small/medium/large/xl}
   - Risk level: {low/medium/high}
   
   ## Implementation Steps
   1. {step 1}
   2. {step 2}
   
   ## Testing Requirements
   - {test requirements}
   
   ## Documentation Updates
   - {doc updates needed}
   ```

2. **Update Parity Status**
   ```bash
   fork-parity-mcp update <commit-hash> --status reviewed
   ```

### Phase 3: Implementation
1. **Create Feature Branch**
   ```bash
   git checkout -b feature/upstream-{feature-name}
   ```

2. **Implement Changes**
   - Follow kuuzuki coding standards
   - Preserve kuuzuki enhancements
   - Add comprehensive tests
   - Update documentation

3. **Track Progress**
   ```bash
   fork-parity-mcp update <commit-hash> --status in_progress
   ```

### Phase 4: Testing and Integration
1. **Comprehensive Testing**
   ```bash
   # Run full test suite
   bun test
   
   # Test specific functionality
   bun test {specific-tests}
   
   # Manual testing
   ./scripts/test-integration.sh
   ```

2. **Code Review**
   - Create pull request
   - Request review from maintainers
   - Address feedback

3. **Merge and Update Status**
   ```bash
   # After merge
   fork-parity-mcp update <commit-hash> --status integrated
   
   # Update knowledge base
   kb_update active/integration-completed-{feature}.md
   ```

## Status Management

### Commit Status Values
- `pending` - Not yet reviewed
- `reviewed` - Analyzed, plan created
- `in_progress` - Currently being integrated
- `integrated` - Successfully integrated
- `enhanced` - Integrated with kuuzuki improvements
- `skipped` - Intentionally not integrated
- `not_applicable` - Doesn't apply to kuuzuki
- `deferred` - Integration postponed

### Updating Status
```bash
# Single commit
fork-parity-mcp update <commit-hash> --status integrated --notes "Integrated with enhancements"

# Batch update
fork-parity-mcp batch-update --status skipped --category infrastructure
```

## Knowledge Base Management

### Key Documents
- `active/opencode-parity-status.md` - Current overall status
- `active/automated-parity-status.md` - Automated analysis results
- `active/feature-analysis-{name}.md` - Feature-specific analysis
- `active/integration-plan-{name}.md` - Integration plans

### Updating Documentation
```bash
# Read current status
kb_read active/opencode-parity-status.md

# Update with new findings
kb_update active/parity-analysis-{topic}.md

# Search for related information
kb_search "authentication parity"
```

## Automation and Notifications

### GitHub Actions
- **Daily Analysis**: Automated parity checking
- **Critical Alerts**: Issues created for urgent items
- **Report Generation**: Comprehensive status reports
- **Cleanup**: Old report management

### Discord Integration
Configure webhook URL in repository secrets:
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Notification Types
- Daily status summaries
- Critical item alerts
- Integration completion notifications
- Weekly parity reports

## Best Practices

### 1. Proactive Monitoring
- Review automated reports regularly
- Set up notifications for critical changes
- Monitor upstream development patterns

### 2. Selective Integration
- Focus on security and bug fixes first
- Evaluate feature relevance to kuuzuki users
- Preserve kuuzuki's unique advantages

### 3. Documentation First
- Document analysis before implementation
- Track decision rationale
- Maintain integration history

### 4. Quality Assurance
- Comprehensive testing for all integrations
- Code review for significant changes
- User impact assessment

### 5. Community Communication
- Share parity status in project updates
- Explain integration decisions
- Gather feedback on priorities

## Troubleshooting

### Common Issues

#### Fork-Parity MCP Not Available
```bash
# Install fork-parity-mcp
npm install -g fork-parity-mcp

# Or use basic git commands
git log --oneline upstream/dev..HEAD
```

#### Upstream Remote Issues
```bash
# Reset upstream remote
git remote remove upstream
git remote add upstream https://github.com/sst/opencode.git
git fetch upstream
```

#### Database Corruption
```bash
# Backup and reset parity database
cp .fork-parity/parity.db .fork-parity/parity.db.backup
rm .fork-parity/parity.db
fork-parity-mcp init
```

### Getting Help
- Check documentation in `docs/PARITY_TRACKING.md`
- Review knowledge base: `kb_search "parity"`
- Ask in project Discord/discussions
- Create GitHub issue with `parity-tracking` label

## Metrics and Reporting

### Key Metrics
- Commits behind upstream
- Critical items pending
- Integration completion rate
- Time to integration
- Feature parity percentage

### Regular Reports
- Daily: Automated status updates
- Weekly: Comprehensive analysis
- Monthly: Strategic assessment
- Quarterly: Architecture alignment review

This workflow ensures kuuzuki maintains strategic alignment with upstream while preserving its unique identity and avoiding unnecessary complexity.
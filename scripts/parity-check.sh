#!/bin/bash

# Kuuzuki Fork Parity Check Script
# This script provides manual parity checking capabilities for developers

set -e

# Configuration
UPSTREAM_REMOTE=${UPSTREAM_REMOTE:-"upstream"}
UPSTREAM_BRANCH=${UPSTREAM_BRANCH:-"dev"}
LOCAL_BRANCH=${LOCAL_BRANCH:-"master"}
REPORTS_DIR=".fork-parity-reports"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in a git repository
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        exit 1
    fi
}

# Setup upstream remote if it doesn't exist
setup_upstream() {
    log_info "Setting up upstream remote..."
    
    if ! git remote get-url $UPSTREAM_REMOTE > /dev/null 2>&1; then
        log_info "Adding upstream remote..."
        git remote add $UPSTREAM_REMOTE https://github.com/sst/opencode.git
    fi
    
    log_info "Fetching from upstream..."
    git fetch $UPSTREAM_REMOTE
    git fetch origin
}

# Get basic parity statistics
get_parity_stats() {
    log_info "Calculating parity statistics..."
    
    # Check if upstream branch exists
    if ! git rev-parse --verify $UPSTREAM_REMOTE/$UPSTREAM_BRANCH > /dev/null 2>&1; then
        log_error "Upstream branch $UPSTREAM_REMOTE/$UPSTREAM_BRANCH not found"
        exit 1
    fi
    
    # Calculate commits behind and ahead
    COMMITS_BEHIND=$(git rev-list --count HEAD..$UPSTREAM_REMOTE/$UPSTREAM_BRANCH)
    COMMITS_AHEAD=$(git rev-list --count $UPSTREAM_REMOTE/$UPSTREAM_BRANCH..HEAD)
    
    # Get recent upstream commits
    RECENT_UPSTREAM=$(git log --oneline -10 $UPSTREAM_REMOTE/$UPSTREAM_BRANCH --pretty=format:"%h %s (%an, %ar)")
    
    echo "=== PARITY STATISTICS ==="
    echo "Commits behind upstream: $COMMITS_BEHIND"
    echo "Commits ahead of upstream: $COMMITS_AHEAD"
    echo ""
    echo "Recent upstream commits:"
    echo "$RECENT_UPSTREAM"
    echo ""
}

# Generate detailed analysis using kuuzuki with fork-parity MCP
generate_detailed_analysis() {
    log_info "Generating detailed parity analysis..."
    
    # Create reports directory
    mkdir -p $REPORTS_DIR
    TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
    
    # Check if kuuzuki is available and can access fork-parity MCP
    if command -v kuuzuki &> /dev/null; then
        log_info "Using kuuzuki with fork-parity MCP for detailed analysis..."
        
        # Generate comprehensive reports using kuuzuki
        echo "Getting detailed parity status..." > "$REPORTS_DIR/manual_status_$TIMESTAMP.json"
        kuuzuki run --prompt "Use fork-parity_fork_parity_get_detailed_status to get comprehensive parity analysis and save the JSON output" > "$REPORTS_DIR/manual_status_$TIMESTAMP.json" 2>/dev/null || log_warning "Status command failed"
        
        echo "Generating parity dashboard..." > "$REPORTS_DIR/manual_dashboard_$TIMESTAMP.md"
        kuuzuki run --prompt "Use fork-parity_fork_parity_generate_dashboard with format=markdown to create a comprehensive dashboard" > "$REPORTS_DIR/manual_dashboard_$TIMESTAMP.md" 2>/dev/null || log_warning "Dashboard command failed"
        
        echo "Getting actionable items..." > "$REPORTS_DIR/manual_actionable_$TIMESTAMP.json"
        kuuzuki run --prompt "Use fork-parity_fork_parity_get_actionable_items with limit=20 to get prioritized action items" > "$REPORTS_DIR/manual_actionable_$TIMESTAMP.json" 2>/dev/null || log_warning "Actionable command failed"
        
        log_success "Detailed reports generated in $REPORTS_DIR/"
        
        # Show basic summary
        echo "=== DETAILED ANALYSIS SUMMARY ==="
        echo "Reports generated at: $TIMESTAMP"
        echo "- Status report: $REPORTS_DIR/manual_status_$TIMESTAMP.json"
        echo "- Dashboard: $REPORTS_DIR/manual_dashboard_$TIMESTAMP.md"
        echo "- Actionable items: $REPORTS_DIR/manual_actionable_$TIMESTAMP.json"
        echo ""
        echo "Key findings:"
        echo "- Commits behind upstream: $COMMITS_BEHIND"
        echo "- Commits ahead of upstream: $COMMITS_AHEAD"
        echo "- Check generated reports for detailed analysis"
        echo ""
    else
        log_warning "kuuzuki not available, using basic git analysis"
        
        # Generate basic analysis
        cat > "$REPORTS_DIR/manual_basic_$TIMESTAMP.md" << EOF
# Manual Parity Check - $TIMESTAMP

## Basic Statistics
- **Commits Behind**: $COMMITS_BEHIND
- **Commits Ahead**: $COMMITS_AHEAD
- **Analysis Method**: Basic Git
- **Generated**: $(date)

## Recent Upstream Commits
\`\`\`
$RECENT_UPSTREAM
\`\`\`

## Recommendations
1. Review recent upstream commits for critical changes
2. Install kuuzuki for detailed MCP-based analysis
3. Check knowledge base for existing parity documentation
4. Consider selective integration of important features

## Next Steps
- Run \`kuuzuki run --prompt "Use kb_read to check active/opencode-parity-status.md"\` for current status
- Use kuuzuki with fork-parity MCP for detailed commit analysis
- Update integration status after reviewing changes
EOF
        
        log_success "Basic analysis generated: $REPORTS_DIR/manual_basic_$TIMESTAMP.md"
    fi
}

# Update knowledge base with current status
update_knowledge_base() {
    log_info "Updating knowledge base..."
    
    # Check if kuuzuki command is available for KB access
    if command -v kuuzuki &> /dev/null; then
        # Update automated status
        cat > "kb/active/manual-parity-check.md" << EOF
# Manual Parity Check - $(date +"%Y-%m-%d %H:%M")

**Performed by**: $(git config user.name || echo "Unknown")
**Analysis Method**: Manual script execution

## Current Status
- **Commits Behind Upstream**: $COMMITS_BEHIND
- **Commits Ahead of Upstream**: $COMMITS_AHEAD
- **Last Manual Check**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

## Recent Upstream Activity
\`\`\`
$RECENT_UPSTREAM
\`\`\`

## Action Items
1. Review commits behind for critical changes
2. Check for security-related updates
3. Evaluate integration opportunities
4. Update parity status after analysis

## Reports Generated
- Location: \`$REPORTS_DIR/\`
- Timestamp: $TIMESTAMP

*This report was generated by manual parity check script.*
EOF
        
        log_success "Knowledge base updated: kb/active/manual-parity-check.md"
        
        # Also update via kuuzuki MCP if possible
        kuuzuki run --prompt "Use kb_update to save this parity check report to active/manual-parity-check.md: $(cat kb/active/manual-parity-check.md)" 2>/dev/null || log_warning "Could not update via kuuzuki MCP"
    else
        log_warning "kuuzuki command not available, skipping knowledge base update"
    fi
}

# Show actionable recommendations
show_recommendations() {
    echo "=== RECOMMENDATIONS ==="
    
    if [ $COMMITS_BEHIND -gt 50 ]; then
        log_warning "Significantly behind upstream ($COMMITS_BEHIND commits)"
        echo "  → Consider comprehensive parity review"
        echo "  → Focus on security and breaking changes first"
    elif [ $COMMITS_BEHIND -gt 10 ]; then
        log_info "Moderately behind upstream ($COMMITS_BEHIND commits)"
        echo "  → Regular parity review recommended"
        echo "  → Check for important feature updates"
    elif [ $COMMITS_BEHIND -gt 0 ]; then
        log_success "Slightly behind upstream ($COMMITS_BEHIND commits)"
        echo "  → Monitor for critical changes"
        echo "  → Consider selective integration"
    else
        log_success "Up to date with upstream!"
    fi
    
    echo ""
    echo "Next steps:"
    echo "1. Review generated reports in $REPORTS_DIR/"
    echo "2. Check knowledge base: kuuzuki run --prompt \"Use kb_read to check active/opencode-parity-status.md\""
    echo "3. Use kuuzuki with fork-parity MCP for detailed analysis"
    echo "4. Update integration status after review"
    echo ""
}

# Main execution
main() {
    echo "🔄 Kuuzuki Fork Parity Check"
    echo "=============================="
    echo ""
    
    check_git_repo
    setup_upstream
    get_parity_stats
    generate_detailed_analysis
    update_knowledge_base
    show_recommendations
    
    log_success "Parity check completed!"
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Kuuzuki Fork Parity Check Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --stats-only   Show only basic statistics"
        echo "  --no-fetch     Skip fetching from remotes"
        echo ""
        echo "Environment variables:"
        echo "  UPSTREAM_REMOTE    Upstream remote name (default: upstream)"
        echo "  UPSTREAM_BRANCH    Upstream branch name (default: dev)"
        echo "  LOCAL_BRANCH       Local branch name (default: master)"
        echo ""
        exit 0
        ;;
    --stats-only)
        check_git_repo
        setup_upstream
        get_parity_stats
        exit 0
        ;;
    --no-fetch)
        check_git_repo
        # Skip setup_upstream which includes fetching
        get_parity_stats
        generate_detailed_analysis
        update_knowledge_base
        show_recommendations
        exit 0
        ;;
    "")
        main
        ;;
    *)
        log_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac
# **Implementation Plan: Kuuzuki CLI Documentation Improvements**

**UPDATE - January 2025**: Phase 1 OpenCode Parity Cleanup has been completed successfully. Command count reduced from 22 → 13 commands. Removed: hybrid, debug (6 subcommands), tui-dev, and schema commands. See `kb/active/phase1-opencode-parity-cleanup.md` for complete details.

## **Phase 1: Content Structure & Organization (High Priority)**

### **1.1 Restructure the Document Layout**

- **Current Structure**: Basic intro → Commands → Flags
- **New Structure**:
  - Introduction & Installation
  - Default Behavior (TUI)
  - Core Commands (run, serve, tui)
  - Management Commands (auth, agent, models)
  - Integration Commands (github, mcp)
  - Utility Commands (stats, git-permissions)
  - Global Flags & Configuration
  - Practical Examples & Workflows
  - Troubleshooting

### **1.2 Add Missing Command Documentation**

**Priority Order:**

1. **`serve`** - Critical for integrations
2. **`agent`** - Key differentiator for kuuzuki
3. **`github`** - Important integration feature
4. **`models`** - Essential for model management
5. **`mcp`** - Advanced feature
6. **`stats`**, **`git-permissions`** - Utility commands

## **Phase 2: Content Development (High Priority)**

### **2.1 Document Missing Commands**

**For each command, include:**

- Command syntax and description
- Available flags and options
- Practical usage examples
- When to use this command
- Related configuration options

**Implementation approach:**

1. Read each command's implementation file
2. Extract builder options and descriptions
3. Create examples based on actual functionality
4. Test commands to verify behavior

### **2.2 Add Community Fork Messaging**

**Key messaging to integrate:**

- "kuuzuki is a community-driven fork focused on terminal workflows"
- "Easy npm installation: `npm install -g kuuzuki`"
- "Built for developers who prefer CLI-first tools"
- "Open to community contributions and enhancements"

**Placement strategy:**

- Introduction section
- Installation section
- Comparison with other tools (subtle)

## **Phase 3: Practical Examples & Workflows (Medium Priority)**

### **3.1 Real-World Usage Examples**

**Categories to cover:**

1. **Quick Tasks**: One-off commands for immediate help
2. **Development Workflows**: Integration with daily coding
3. **Code Review**: Using kuuzuki for PR reviews
4. **Debugging**: Troubleshooting with AI assistance
5. **Learning**: Understanding unfamiliar codebases

### **3.2 Workflow Integration Examples**

**Examples to create:**

```bash
# Quick code review
kuuzuki run "Review this file for security vulnerabilities" @src/auth.ts

# Interactive development session
kuuzuki  # Starts TUI for ongoing work

# Automated testing help
kuuzuki run --continue "The tests are failing with this error: [error]"

# Documentation generation
kuuzuki run "Generate API documentation for this module" @src/api/

# Refactoring assistance
kuuzuki run "Help me refactor this component to use hooks" @components/ClassComponent.jsx
```

## **Phase 4: Advanced Features Documentation (Medium Priority)**

### **4.1 Server Mode Documentation**

**Content to add:**

- When to use headless server mode
- Integration with IDEs and editors
- API endpoints (if applicable)
- Performance considerations
- Security considerations for network exposure

### **4.2 Agent Management**

**Content to add:**

- Agent creation workflow
- Global vs project-specific agents
- Tool selection and permissions
- Agent configuration examples
- Best practices for agent design

### **4.3 GitHub Integration**

**Content to add:**

- Installation process
- Workflow file setup
- Secret configuration
- Usage in issues and PRs
- Permissions and security

## **Phase 5: Configuration & Troubleshooting (Medium Priority)**

### **5.1 Configuration Integration**

**Content to add:**

- How CLI flags override config file settings
- Common configuration patterns
- Environment variable usage
- Project vs global configuration

### **5.2 Troubleshooting Section**

**Common issues to document:**

- npm installation problems
- Permission errors
- API key configuration
- Network connectivity issues
- Path and environment problems
- Model availability issues

## **Phase 6: Quality Assurance (Low Priority)**

### **6.1 Testing & Verification**

**Testing approach:**

1. Test all documented commands
2. Verify all examples work as described
3. Check all links and references
4. Validate code syntax in examples
5. Test on different operating systems

### **6.2 Review & Polish**

**Review checklist:**

- Consistent terminology throughout
- Clear and concise language
- Logical flow and organization
- Complete coverage of features
- Accurate technical details

## **Implementation Strategy**

### **File Organization**

- Keep the main CLI documentation in `/docs/cli.mdx`
- Consider splitting into multiple files if it becomes too long:
  - `/docs/cli/index.mdx` - Main CLI overview
  - `/docs/cli/commands.mdx` - Detailed command reference
  - `/docs/cli/examples.mdx` - Practical examples
  - `/docs/cli/troubleshooting.mdx` - Common issues

### **Content Development Process**

1. **Research Phase**: Read implementation files for each command
2. **Draft Phase**: Create content sections incrementally
3. **Example Phase**: Develop and test practical examples
4. **Review Phase**: Ensure accuracy and completeness
5. **Polish Phase**: Improve readability and flow

### **Validation Process**

1. **Technical Validation**: Test all commands and examples
2. **User Experience Validation**: Ensure documentation serves user needs
3. **Consistency Validation**: Check against other documentation
4. **Accessibility Validation**: Ensure clear language and structure

## **Success Metrics**

### **Completeness**

- [ ] All implemented commands documented
- [ ] All major use cases covered
- [ ] All flags and options explained
- [ ] Troubleshooting covers common issues

### **Quality**

- [ ] All examples tested and working
- [ ] Clear, concise language throughout
- [ ] Logical organization and flow
- [ ] Consistent with project branding

### **User Value**

- [ ] New users can get started quickly
- [ ] Experienced users can find advanced features
- [ ] Common problems have clear solutions
- [ ] Integration workflows are well-documented

## **Missing Commands Analysis**

Based on implementation research, the following commands are missing from current documentation:

### **Core Missing Commands:**

1. **`serve`** - Headless server mode
2. **`agent create`** - Agent management
3. **`github install/run`** - GitHub integration
4. **`models`** - Model management
5. **`mcp`** - MCP server management
6. **`debug`** - Debug utilities
7. **`stats`** - Usage statistics
8. **`generate`** - Code generation
9. **`billing`** - Billing management
10. **`apikey`** - API key management

### **Implementation Priority:**

1. **High**: serve, agent, github, models
2. **Medium**: mcp, debug, stats
3. **Low**: generate, billing, apikey

This plan provides a systematic approach to creating comprehensive, accurate, and user-friendly CLI documentation that properly represents kuuzuki as a community-driven, terminal-focused AI coding assistant.

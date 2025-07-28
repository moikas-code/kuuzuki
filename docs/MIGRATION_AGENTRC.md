# Migrating from AGENTS.md to .agentrc

This guide helps you migrate from the legacy `AGENTS.md` format to the new structured `.agentrc` configuration format.

## Why Migrate?

The new `.agentrc` format provides several advantages over `AGENTS.md`:

- **Machine-readable**: JSON structure enables better parsing and validation
- **Structured data**: Commands, tools, and settings are in predictable locations
- **IDE support**: JSON schema provides autocomplete and validation
- **Extensible**: Easy to add new fields without breaking existing parsers
- **Multi-tool support**: Other AI tools can adopt the same format

## Automatic Migration

### Using `/init` Command

The easiest way to migrate is to use the `/init` command:

```bash
/init
```

This will:

1. Analyze your existing `AGENTS.md` and `CLAUDE.md` files
2. Extract structured information (commands, tools, conventions) from AGENTS.md
3. Extract development rules and guidelines from both AGENTS.md and CLAUDE.md
4. Include rules from `.cursor/rules/`, `.cursorrules`, and `.github/copilot-instructions.md`
5. Generate a comprehensive `.agentrc` file that consolidates all existing project knowledge
6. Preserve important context while converting to structured format

### What Gets Converted

| Source File      | Content Type         | .agentrc Field        | Example                        |
| ---------------- | -------------------- | --------------------- | ------------------------------ |
| AGENTS.md        | Build commands       | `commands.build`      | `npm run build`                |
| AGENTS.md        | Test commands        | `commands.test`       | `npm test`                     |
| AGENTS.md        | Lint commands        | `commands.lint`       | `eslint src/`                  |
| AGENTS.md        | Project description  | `project.description` | Brief project overview         |
| AGENTS.md        | Code style rules     | `codeStyle` object    | Formatter, linter settings     |
| AGENTS.md        | File naming patterns | `conventions` object  | camelCase, kebab-case          |
| AGENTS.md        | Tool mentions        | `tools` object        | npm, webpack, react            |
| AGENTS.md        | Development rules    | `rules` array         | List of guidelines             |
| CLAUDE.md        | Coding standards     | `rules` array         | "Use TypeScript strict mode"   |
| CLAUDE.md        | Best practices       | `rules` array         | "Prefer functional components" |
| CLAUDE.md        | Style preferences    | `codeStyle` object    | Quote style, formatting        |
| .cursorrules     | Development rules    | `rules` array         | Cursor-specific guidelines     |
| .cursor/rules/\* | Project rules        | `rules` array         | Modular rule files             |

## Manual Migration Examples

### Example 1: Basic Project

**Before (AGENTS.md):**

```markdown
# My React App

This is a React application with TypeScript.

## Commands

- Build: `npm run build`
- Test: `npm test`
- Dev: `npm start`

## Rules

- Use TypeScript strict mode
- Prefer functional components
- Write tests for all components
```

**After (.agentrc):**

```json
{
  "project": {
    "name": "My React App",
    "type": "react-typescript-app",
    "description": "React application with TypeScript"
  },
  "commands": {
    "build": "npm run build",
    "test": "npm test",
    "dev": "npm start"
  },
  "codeStyle": {
    "language": "typescript"
  },
  "tools": {
    "packageManager": "npm",
    "framework": "react"
  },
  "rules": ["Use TypeScript strict mode", "Prefer functional components", "Write tests for all components"]
}
```

### Example 2: Monorepo Project

**Before (AGENTS.md):**

```markdown
# Full-Stack Monorepo

This is a monorepo with frontend, backend, and shared packages.

## Structure

- `packages/frontend/` - React frontend
- `packages/backend/` - Node.js API
- `packages/shared/` - Shared utilities

## Commands

- Build all: `turbo run build`
- Test all: `turbo run test`
- Test single: `turbo run test --filter=<package>`

## Code Standards

- Use TypeScript everywhere
- Shared code goes in packages/shared
- Use pnpm for package management
```

**After (.agentrc):**

```json
{
  "project": {
    "name": "Full-Stack Monorepo",
    "type": "typescript-monorepo",
    "description": "Monorepo with frontend, backend, and shared packages",
    "structure": {
      "packages": ["frontend", "backend", "shared"],
      "srcDir": "packages"
    }
  },
  "commands": {
    "build": "turbo run build",
    "test": "turbo run test",
    "testSingle": "turbo run test --filter={file}"
  },
  "codeStyle": {
    "language": "typescript"
  },
  "tools": {
    "packageManager": "pnpm",
    "bundler": "turbo"
  },
  "paths": {
    "src": "packages",
    "frontend": "packages/frontend",
    "backend": "packages/backend",
    "shared": "packages/shared"
  },
  "rules": ["Use TypeScript everywhere", "Shared code goes in packages/shared"]
}
```

### Example 3: Project with CLAUDE.md Integration

**Before (AGENTS.md + CLAUDE.md):**

AGENTS.md:

```markdown
# React TypeScript App

## Commands

- Build: `npm run build`
- Test: `npm test`
- Dev: `npm start`

## Structure

- `src/` - Source code
- `src/components/` - React components
```

CLAUDE.md:

```markdown
# Development Guidelines

## Code Style

- Always use TypeScript strict mode
- Prefer functional components over class components
- Use React hooks instead of lifecycle methods
- All props must have proper TypeScript interfaces

## Testing

- Write unit tests for all components
- Use React Testing Library for component tests
- Aim for 80%+ test coverage

## Performance

- Use React.memo for expensive components
- Implement proper key props in lists
- Avoid inline functions in render methods
```

**After (.agentrc):**

```json
{
  "project": {
    "name": "React TypeScript App",
    "type": "react-typescript-app"
  },
  "commands": {
    "build": "npm run build",
    "test": "npm test",
    "dev": "npm start"
  },
  "codeStyle": {
    "language": "typescript"
  },
  "tools": {
    "packageManager": "npm",
    "framework": "react",
    "testing": "react-testing-library"
  },
  "paths": {
    "src": "src",
    "components": "src/components"
  },
  "rules": [
    "Always use TypeScript strict mode",
    "Prefer functional components over class components",
    "Use React hooks instead of lifecycle methods",
    "All props must have proper TypeScript interfaces",
    "Write unit tests for all components",
    "Use React Testing Library for component tests",
    "Aim for 80%+ test coverage",
    "Use React.memo for expensive components",
    "Implement proper key props in lists",
    "Avoid inline functions in render methods"
  ]
}
```

### Example 4: Python Project

**Before (AGENTS.md):**

```markdown
# ML Service

Python-based machine learning service.

## Setup

- Install: `pip install -r requirements.txt`
- Test: `pytest`
- Lint: `ruff check .`
- Format: `black .`

## Guidelines

- Use type hints everywhere
- Follow PEP 8 style guide
- Write docstrings for all functions
- Use pytest for testing
```

**After (.agentrc):**

```json
{
  "project": {
    "name": "ML Service",
    "type": "python-ml-service",
    "description": "Python-based machine learning service"
  },
  "commands": {
    "install": "pip install -r requirements.txt",
    "test": "pytest",
    "lint": "ruff check .",
    "format": "black ."
  },
  "codeStyle": {
    "language": "python",
    "formatter": "black",
    "linter": "ruff"
  },
  "tools": {
    "packageManager": "pip",
    "runtime": "python",
    "testing": "pytest"
  },
  "rules": [
    "Use type hints everywhere",
    "Follow PEP 8 style guide",
    "Write docstrings for all functions",
    "Use pytest for testing"
  ]
}
```

## Migration Strategies

### Strategy 1: Complete Replacement

Replace `AGENTS.md` entirely with `.agentrc`:

1. Create `.agentrc` with structured data
2. Move prose content to separate documentation files
3. Update `kuuzuki.json` to include additional instruction files
4. Remove `AGENTS.md`

### Strategy 2: Gradual Migration

Keep both files during transition:

1. Create `.agentrc` with structured data
2. Keep `AGENTS.md` for prose content
3. kuuzuki will merge both automatically
4. Gradually move content from `AGENTS.md` to `.agentrc`
5. Eventually remove `AGENTS.md`

### Strategy 3: Hybrid Approach

Use both formats for different purposes:

1. `.agentrc` for machine-readable configuration
2. `AGENTS.md` for detailed explanations and examples
3. Reference `AGENTS.md` in `kuuzuki.json` instructions

## Common Migration Patterns

### Extracting Commands

Look for command patterns in your `AGENTS.md`:

```markdown
<!-- AGENTS.md patterns -->

- Build: `npm run build`
- Run tests: `yarn test`
- Start dev server: `pnpm dev`
- Lint code: `eslint .`
```

Convert to:

```json
{
  "commands": {
    "build": "npm run build",
    "test": "yarn test",
    "dev": "pnpm dev",
    "lint": "eslint ."
  }
}
```

### Extracting Tools

Look for tool mentions:

```markdown
<!-- AGENTS.md -->

This project uses React with TypeScript, bundled with Vite.
We use Jest for testing and Prettier for formatting.
```

Convert to:

```json
{
  "tools": {
    "framework": "react",
    "bundler": "vite",
    "testing": "jest",
    "formatter": "prettier"
  },
  "codeStyle": {
    "language": "typescript",
    "formatter": "prettier"
  }
}
```

### Extracting Conventions

Look for naming and style patterns:

```markdown
<!-- AGENTS.md -->

- Use camelCase for variables and functions
- Use PascalCase for components
- Test files should end with .test.ts
- Use double quotes for strings
```

Convert to:

```json
{
  "conventions": {
    "variableNaming": "camelCase",
    "functionNaming": "camelCase",
    "componentNaming": "PascalCase",
    "testFiles": "*.test.ts"
  },
  "codeStyle": {
    "quotesStyle": "double"
  }
}
```

## Validation and Testing

### Validate Your .agentrc

After migration, validate your `.agentrc` file:

```bash
# Test with kuuzuki
kuuzuki validate .agentrc

# Or use a JSON schema validator
jsonschema -i .agentrc https://kuuzuki.ai/agentrc.json
```

### Test Agent Behavior

1. Run `/init` to see if kuuzuki properly reads your configuration
2. Try common commands to ensure they work
3. Check that code style preferences are applied

## Troubleshooting

### Common Issues

1. **JSON Syntax Errors**

   - Use a JSON validator or editor with JSON support
   - Check for trailing commas, missing quotes

2. **Command Not Working**

   - Test commands manually before adding to `.agentrc`
   - Use full paths if relative paths don't work

3. **Missing Information**
   - Some prose content may not fit structured format
   - Keep important explanations in separate instruction files

### Getting Help

- Use `/init` for automatic conversion
- Check the [.agentrc documentation](./AGENTRC.md) for field reference
- Look at example `.agentrc` files in similar projects

## Best Practices After Migration

1. **Keep It Updated**: Update `.agentrc` when you change tools or conventions
2. **Commit to Git**: Share configuration with your team
3. **Use Schema Validation**: Add `$schema` field for IDE support
4. **Document Complex Rules**: Use separate files for detailed explanations
5. **Test Regularly**: Ensure commands and settings work as expected

## Schema Reference

Add schema validation to your `.agentrc`:

```json
{
  "$schema": "https://kuuzuki.ai/agentrc.json",
  "project": {
    // ... your configuration
  }
}
```

This enables:

- IDE autocomplete and validation
- Real-time error checking
- Documentation tooltips

## Example Migration Script

For large projects, you might want to automate migration:

```bash
#!/bin/bash
# migrate-agents.sh

# Backup existing AGENTS.md
if [ -f "AGENTS.md" ]; then
    cp AGENTS.md AGENTS.md.backup
    echo "Backed up AGENTS.md to AGENTS.md.backup"
fi

# Run kuuzuki init to generate .agentrc
kuuzuki run "/init"

# Validate the result
if [ -f ".agentrc" ]; then
    echo "✅ .agentrc created successfully"
    kuuzuki validate .agentrc
else
    echo "❌ Failed to create .agentrc"
    exit 1
fi

echo "Migration complete! Review .agentrc and remove AGENTS.md when ready."
```

The migration to `.agentrc` provides a more structured and maintainable way to configure AI agents for your project while maintaining backward compatibility during the transition period.

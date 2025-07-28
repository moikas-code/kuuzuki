# .agentrc Configuration

The `.agentrc` file is a JSON configuration file that provides structured information about your project to AI coding agents like kuuzuki. It replaces the previous `AGENTS.md` format with a machine-readable structure that enables better integration and more precise agent behavior.

## Overview

The `.agentrc` file contains structured metadata about your project including:

- Build and development commands
- Code style preferences
- Project structure and conventions
- Tools and technologies used
- Development rules and guidelines
- AI agent specific settings

## File Location

`.agentrc` files are searched in the following order:

1. **Project-specific**: From current directory up to git root
2. **Global**: `~/.config/kuuzuki/.agentrc`

If both exist, they are merged with project-specific settings taking precedence.

### Legacy File Support

kuuzuki also automatically integrates legacy configuration files:

- **AGENTS.md**: Project and global locations (`AGENTS.md`, `~/.config/kuuzuki/AGENTS.md`)
- **CLAUDE.md**: Project and global locations (`CLAUDE.md`, `~/.claude/CLAUDE.md`)
- **Cursor rules**: `.cursor/rules/`, `.cursorrules`
- **Copilot instructions**: `.github/copilot-instructions.md`

These files are automatically parsed and their content is integrated with `.agentrc` configurations.

## Creating a .agentrc File

### Automatic Generation

Use the `/init` command in kuuzuki to automatically analyze your project and generate a `.agentrc` file:

```bash
/init
```

This will:

- Analyze your project structure and configuration files
- Extract build commands from `package.json`, `Makefile`, etc.
- Detect code style from existing formatters and linters
- **Integrate existing AGENTS.md and CLAUDE.md files** - converting structured data and preserving rules
- Include rules from `.cursor/rules/`, `.cursorrules`, and `.github/copilot-instructions.md`
- Generate a comprehensive `.agentrc` file that consolidates all project knowledge

### Manual Creation

You can also create a `.agentrc` file manually. Here's a complete example:

```json
{
  "project": {
    "name": "my-awesome-app",
    "type": "typescript-react-app",
    "description": "A modern React application with TypeScript",
    "version": "1.0.0",
    "structure": {
      "packages": ["frontend", "backend", "shared"],
      "mainEntry": "src/index.tsx",
      "srcDir": "src",
      "testDir": "src/__tests__",
      "docsDir": "docs"
    }
  },
  "commands": {
    "build": "npm run build",
    "test": "npm test",
    "testSingle": "npm test -- {file}",
    "testWatch": "npm test -- --watch",
    "lint": "eslint src/",
    "lintFix": "eslint src/ --fix",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write src/",
    "dev": "npm run dev",
    "start": "npm start"
  },
  "codeStyle": {
    "language": "typescript",
    "formatter": "prettier",
    "linter": "eslint",
    "importStyle": "esm",
    "quotesStyle": "double",
    "semicolons": false,
    "trailingCommas": true,
    "indentation": {
      "type": "spaces",
      "size": 2
    }
  },
  "conventions": {
    "fileNaming": "kebab-case",
    "functionNaming": "camelCase",
    "variableNaming": "camelCase",
    "componentNaming": "PascalCase",
    "constantNaming": "UPPER_CASE",
    "testFiles": "*.test.{ts,tsx}",
    "configFiles": ["tsconfig.json", "package.json", ".eslintrc.js"]
  },
  "tools": {
    "packageManager": "npm",
    "runtime": "node",
    "bundler": "vite",
    "framework": "react",
    "database": "postgresql",
    "orm": "prisma",
    "testing": "jest",
    "ci": "github-actions"
  },
  "paths": {
    "src": "src",
    "tests": "src/__tests__",
    "docs": "docs",
    "config": "config",
    "build": "dist",
    "assets": "public"
  },
  "rules": [
    "Always use TypeScript strict mode",
    "Prefer functional components with hooks over class components",
    "Use async/await instead of .then() for promises",
    "All components must have proper TypeScript types",
    "Write tests for all business logic functions",
    "Use semantic commit messages"
  ],
  "dependencies": {
    "critical": ["react", "typescript", "@types/node"],
    "preferred": ["lodash-es", "date-fns", "zod"],
    "avoid": ["moment", "jquery", "underscore"]
  },
  "environment": {
    "nodeVersion": ">=18.0.0",
    "envFiles": [".env", ".env.local", ".env.production"],
    "requiredEnvVars": ["DATABASE_URL", "API_KEY"],
    "deployment": {
      "platform": "vercel",
      "buildCommand": "npm run build",
      "outputDir": "dist"
    }
  },
  "mcp": {
    "servers": {
      "filesystem": {
        "transport": "stdio",
        "command": ["npx", "@modelcontextprotocol/server-filesystem", "./src"],
        "notes": "File system access for source code"
      },
      "database": {
        "transport": "stdio",
        "command": ["python", "-m", "mcp_server_postgres"],
        "env": {
          "DATABASE_URL": "${DATABASE_URL}"
        },
        "notes": "PostgreSQL database operations"
      }
    },
    "preferredServers": ["filesystem", "database"]
  },
  "agent": {
    "preferredTools": ["read", "write", "edit", "bash", "grep"],
    "disabledTools": ["webfetch"],
    "maxFileSize": 100000,
    "ignorePatterns": ["node_modules/**", "dist/**", "*.log"],
    "contextFiles": ["README.md", "package.json", "tsconfig.json"]
  },
  "metadata": {
    "version": "1.0.0",
    "created": "2025-01-28T10:30:00Z",
    "updated": "2025-01-28T10:30:00Z",
    "generator": "kuuzuki-init",
    "author": "Development Team"
  }
}
```

## Configuration Schema

### Project Information

```json
{
  "project": {
    "name": "string", // Project name
    "type": "string", // Project type (e.g., "typescript-monorepo")
    "description": "string", // Brief description
    "version": "string", // Project version
    "structure": {
      "packages": ["string"], // Package names in monorepos
      "mainEntry": "string", // Main entry point
      "srcDir": "string", // Source directory
      "testDir": "string", // Test directory
      "docsDir": "string" // Documentation directory
    }
  }
}
```

### Commands

Define the key commands for your project:

```json
{
  "commands": {
    "build": "npm run build",
    "test": "npm test",
    "testSingle": "npm test -- {file}", // Use {file} placeholder
    "testWatch": "npm test -- --watch",
    "lint": "eslint src/",
    "lintFix": "eslint src/ --fix",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write src/",
    "dev": "npm run dev",
    "start": "npm start",
    "install": "npm install",
    "clean": "rm -rf dist",
    "deploy": "npm run deploy"
  }
}
```

### Code Style

Specify your code formatting and style preferences:

```json
{
  "codeStyle": {
    "language": "typescript",
    "formatter": "prettier",
    "linter": "eslint",
    "importStyle": "esm", // "esm" | "commonjs" | "mixed"
    "quotesStyle": "double", // "single" | "double" | "backtick"
    "semicolons": false,
    "trailingCommas": true,
    "indentation": {
      "type": "spaces", // "spaces" | "tabs"
      "size": 2
    }
  }
}
```

### Naming Conventions

Define naming patterns for different code elements:

```json
{
  "conventions": {
    "fileNaming": "kebab-case", // "camelCase" | "PascalCase" | "kebab-case" | "snake_case"
    "functionNaming": "camelCase",
    "variableNaming": "camelCase",
    "componentNaming": "PascalCase",
    "constantNaming": "UPPER_CASE", // "UPPER_CASE" | "camelCase" | "PascalCase"
    "testFiles": "*.test.{ts,tsx}",
    "configFiles": ["tsconfig.json", "package.json"]
  }
}
```

### Tools and Technologies

Specify the tools and frameworks used in your project:

```json
{
  "tools": {
    "packageManager": "npm", // "npm" | "yarn" | "pnpm" | "bun"
    "runtime": "node",
    "bundler": "vite",
    "framework": "react",
    "database": "postgresql",
    "orm": "prisma",
    "testing": "jest",
    "ci": "github-actions"
  }
}
```

### Important Paths

Define key directories in your project:

```json
{
  "paths": {
    "src": "src",
    "tests": "src/__tests__",
    "docs": "docs",
    "config": "config",
    "build": "dist",
    "assets": "public",
    "scripts": "scripts"
  }
}
```

### Development Rules

List important development guidelines:

```json
{
  "rules": [
    "Always use TypeScript strict mode",
    "Prefer async/await over promises",
    "Write tests for all business logic",
    "Use semantic commit messages",
    "Follow the existing error handling patterns"
  ]
}
```

### Dependencies

Specify dependency preferences:

```json
{
  "dependencies": {
    "critical": ["react", "typescript"], // Don't change these
    "preferred": ["lodash-es", "date-fns"], // Use these when possible
    "avoid": ["moment", "jquery"] // Don't use these
  }
}
```

### Environment Configuration

Define environment and deployment settings:

```json
{
  "environment": {
    "nodeVersion": ">=18.0.0",
    "envFiles": [".env", ".env.local"],
    "requiredEnvVars": ["DATABASE_URL", "API_KEY"],
    "deployment": {
      "platform": "vercel",
      "buildCommand": "npm run build",
      "outputDir": "dist"
    }
  }
}
```

### MCP Server Configuration

Configure MCP (Model Context Protocol) server connections based on the [official MCP specification](https://modelcontextprotocol.io/). MCP servers are self-describing and automatically provide their available tools, resources, and prompts when they connect.

```json
{
  "mcp": {
    "servers": {
      "filesystem": {
        "transport": "stdio",
        "command": ["npx", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"],
        "notes": "File system access with restricted permissions"
      },
      "database": {
        "transport": "stdio",
        "command": ["python", "-m", "mcp_server_sqlite", "--db-path", "./data.db"],
        "env": {
          "DB_PATH": "./data.db"
        },
        "notes": "SQLite database operations"
      },
      "web-search": {
        "transport": "http",
        "url": "https://api.example.com/mcp",
        "headers": {
          "Authorization": "Bearer ${SEARCH_API_KEY}"
        },
        "notes": "Web search capabilities via HTTP"
      }
    },
    "preferredServers": ["filesystem", "database"],
    "disabledServers": ["web-search"]
  }
}
```

#### **MCP Transport Types**

MCP supports two official transport mechanisms:

**STDIO Transport** (for local servers):

- Uses standard input/output streams for direct process communication
- Optimal performance with no network overhead
- Runs on the same machine as the MCP client (kuuzuki)

**HTTP Transport** (for remote servers):

- Uses HTTP POST for client-to-server messages
- Supports Server-Sent Events for streaming capabilities
- Enables remote server communication with standard HTTP authentication

#### **Important Notes**

- **Self-describing**: MCP servers automatically provide their available tools, resources, and prompts through the MCP protocol
- **Connection only**: The .agentrc only needs connection details - no need to specify tools or capabilities
- **Runtime discovery**: Tool definitions, resource schemas, and prompt templates are discovered at runtime via `*/list` methods
- **Lifecycle management**: MCP handles capability negotiation and connection initialization automatically
- **Optional notes**: Use the `notes` field for documentation purposes only

### AI Agent Settings

Configure AI agent behavior for built-in tools:

```json
{
  "agent": {
    "preferredTools": ["read", "write", "edit", "bash"],
    "disabledTools": ["webfetch"],
    "maxFileSize": 100000,
    "ignorePatterns": ["node_modules/**", "*.log"],
    "contextFiles": ["README.md", "package.json"]
  }
}
```

## Migration from AGENTS.md

If you have an existing `AGENTS.md` file, you can:

1. **Automatic conversion**: Run `/init` and kuuzuki will convert existing content
2. **Manual conversion**: Use this mapping guide:

### AGENTS.md → .agentrc Mapping

| AGENTS.md Content    | .agentrc Field                          |
| -------------------- | --------------------------------------- |
| Build commands       | `commands.build`, `commands.test`, etc. |
| Code style rules     | `codeStyle` object                      |
| File naming patterns | `conventions` object                    |
| Project description  | `project.description`                   |
| Development rules    | `rules` array                           |
| Tool preferences     | `tools` object                          |

### Example Conversion

**AGENTS.md:**

```markdown
# My Project

This is a TypeScript React app.

## Commands

- Build: `npm run build`
- Test: `npm test`

## Rules

- Use TypeScript strict mode
- Prefer functional components
```

**Equivalent .agentrc:**

```json
{
  "project": {
    "name": "My Project",
    "type": "typescript-react-app"
  },
  "commands": {
    "build": "npm run build",
    "test": "npm test"
  },
  "rules": ["Use TypeScript strict mode", "Prefer functional components"]
}
```

## Best Practices

### 1. Keep It Current

- Update `.agentrc` when you change build tools or conventions
- Use version control to track changes
- Consider it part of your project documentation

### 2. Be Specific

- Provide exact commands rather than generic descriptions
- Include file patterns and naming conventions
- Specify version requirements where relevant

### 3. Team Consistency

- Commit `.agentrc` to version control
- Ensure all team members understand the conventions
- Use it as a reference for new team members

### 4. Validation

The `.agentrc` file is validated against a JSON schema. Invalid files will show helpful error messages.

### 5. Gradual Adoption

- Start with basic fields and expand over time
- All fields are optional - include what's relevant
- Legacy `AGENTS.md` files continue to work

## Integration with Other Tools

### IDE Support

Many editors can provide autocomplete and validation for `.agentrc` files when you include the schema reference:

```json
{
  "$schema": "https://kuuzuki.ai/agentrc.json",
  "project": {
    // ... your configuration
  }
}
```

### CI/CD Integration

You can validate `.agentrc` files in your CI pipeline:

```bash
# Validate .agentrc file
kuuzuki validate .agentrc
```

### Team Sharing

- **Project-level**: Commit to version control for team consistency
- **Global-level**: Personal preferences in `~/.config/kuuzuki/.agentrc`

## Troubleshooting

### Common Issues

1. **JSON Syntax Errors**

   - Use a JSON validator or editor with JSON support
   - Check for trailing commas, missing quotes, etc.

2. **Schema Validation Errors**

   - Check the error message for specific field issues
   - Refer to the schema documentation above

3. **Command Not Working**

   - Test commands manually before adding to `.agentrc`
   - Use absolute paths if relative paths don't work

4. **File Not Found**
   - Ensure `.agentrc` is in the project root or global config directory
   - Check file permissions

### Getting Help

- Use `/init` to generate a starting template
- Check existing `.agentrc` files in similar projects
- Refer to the JSON schema for field validation

## Examples

### Monorepo Example

```json
{
  "project": {
    "name": "my-monorepo",
    "type": "typescript-monorepo",
    "structure": {
      "packages": ["frontend", "backend", "shared", "mobile"]
    }
  },
  "commands": {
    "build": "turbo run build",
    "test": "turbo run test",
    "testSingle": "turbo run test --filter={file}",
    "lint": "turbo run lint"
  },
  "tools": {
    "packageManager": "pnpm",
    "bundler": "turbo"
  },
  "mcp": {
    "servers": {
      "monorepo-tools": {
        "transport": "stdio",
        "command": ["node", "./tools/mcp-server.js"],
        "notes": "Monorepo-specific tools for package management"
      },
      "database": {
        "transport": "stdio",
        "command": ["python", "-m", "mcp_server_postgres"],
        "notes": "Shared database access across packages"
      }
    },
    "preferredServers": ["monorepo-tools", "database"]
  }
}
```

### Python Project Example

```json
{
  "project": {
    "name": "ml-service",
    "type": "python-api",
    "description": "Machine learning API service"
  },
  "commands": {
    "test": "pytest",
    "testSingle": "pytest {file}",
    "lint": "ruff check .",
    "format": "black .",
    "typecheck": "mypy ."
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
  "mcp": {
    "servers": {
      "jupyter": {
        "transport": "stdio",
        "command": ["python", "-m", "mcp_server_jupyter"],
        "env": {
          "JUPYTER_CONFIG_DIR": "./jupyter_config"
        },
        "notes": "Jupyter notebook integration for ML experiments"
      },
      "mlflow": {
        "transport": "http",
        "url": "http://localhost:5000/mcp",
        "headers": {
          "Authorization": "Bearer ${MLFLOW_TOKEN}"
        },
        "notes": "MLflow experiment tracking"
      }
    },
    "preferredServers": ["jupyter", "mlflow"]
  }
}
```

The `.agentrc` format provides a structured, extensible way to configure AI agents for your specific project needs while maintaining backward compatibility with existing `AGENTS.md` files.

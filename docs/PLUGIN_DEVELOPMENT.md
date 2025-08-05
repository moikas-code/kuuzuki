# Plugin Development Guide

## Overview

kuuzuki's plugin system allows developers to extend functionality through a comprehensive hook-based architecture. Plugins can intercept and modify chat interactions, tool executions, permission decisions, and system events.

## Quick Start

### 1. Basic Plugin Structure

```javascript
// my-plugin.js
export const myPlugin = async ({ client, app, $ }) => {
  console.log("Plugin initialized for app at:", app.path.root);

  return {
    // Hook implementations
    "chat.message": async (input, output) => {
      // Modify chat messages
      output.parts.forEach((part) => {
        part.metadata = { ...part.metadata, processedBy: "my-plugin" };
      });
    },

    "tool.execute.before": async (input, output) => {
      // Intercept tool execution
      console.log(`Executing tool: ${input.tool}`);
    },
  };
};
```

### 2. Configuration

Add your plugin to `.agentrc`. kuuzuki supports multiple plugin loading methods:

```json
{
  "plugin": [
    "./path/to/my-plugin.js", // Local file path
    "file:///absolute/path/plugin.js", // File URL
    "@my-org/kuuzuki-plugin-name", // NPM scoped package
    "simple-plugin-name@1.2.3", // NPM package with version
    "@kuuzuki/official-plugin@latest" // Official kuuzuki plugins
  ]
}
```

#### Plugin Loading Methods

**Local File Paths**

```json
{
  "plugin": [
    "./plugins/my-plugin.js", // Relative to project root
    "../shared/plugin.js", // Relative path
    "/absolute/path/plugin.js" // Absolute path
  ]
}
```

**NPM Packages** ✨ **NEW**

```json
{
  "plugin": [
    "lodash@4.17.21", // Regular package with version
    "@types/node@18.0.0", // Scoped package with version
    "@kuuzuki/plugin-logger", // Scoped package, latest version
    "simple-plugin" // Regular package, latest version
  ]
}
```

**File URLs**

```json
{
  "plugin": [
    "file:///home/user/plugins/custom.js", // Absolute file URL
    "file://./relative/plugin.js" // Relative file URL
  ]
}
```

### 3. Using the Plugin SDK

```javascript
import { definePlugin } from "@kuuzuki/plugin";

export const MyPlugin = definePlugin(
  {
    name: "my-plugin",
    version: "1.0.0",
    description: "My awesome kuuzuki plugin",
    author: "Your Name",
    keywords: ["chat", "enhancement"],
  },
  async ({ client, app }) => {
    // Plugin implementation
    return {
      "chat.message": async (input, output) => {
        // Your hook logic here
      },
    };
  },
);
```

## Available Hooks

### Chat Hooks

#### `chat.message`

Triggered after AI generates a chat message.

```typescript
"chat.message": async (
  input: {},
  output: { message: any; parts: any[] }
) => {
  // Modify the message or parts
  output.parts.forEach(part => {
    part.metadata = { ...part.metadata, enhanced: true };
  });
}
```

#### `chat.params`

Triggered before sending parameters to AI provider.

```typescript
"chat.params": async (
  input: { model: any; provider: any; message: any },
  output: { temperature?: number; topP?: number }
) => {
  // Adjust AI parameters based on context
  if (input.message.content.includes("creative")) {
    output.temperature = 0.9;
  }
}
```

### Tool Hooks

#### `tool.execute.before`

Triggered before tool execution.

```typescript
"tool.execute.before": async (
  input: { tool: string; sessionID: string; callID: string },
  output: { args: any }
) => {
  // Modify tool arguments
  if (input.tool === "bash") {
    output.args.timeout = Math.min(output.args.timeout || 30000, 60000);
  }
}
```

#### `tool.execute.after`

Triggered after tool execution.

```typescript
"tool.execute.after": async (
  input: { tool: string; sessionID: string; callID: string },
  output: { title: string; output: string; metadata: any }
) => {
  // Process tool results
  output.metadata = { ...output.metadata, processedAt: Date.now() };
}
```

### Permission Hooks

#### `permission.ask`

Triggered when permission is requested.

```typescript
"permission.ask": async (
  input: any,
  output: { status: "ask" | "deny" | "allow" }
) => {
  // Auto-approve safe operations
  if (input.pattern?.startsWith("ls ")) {
    output.status = "allow";
  }

  // Auto-deny dangerous operations
  if (input.pattern?.includes("rm -rf")) {
    output.status = "deny";
  }
}
```

### Event Hooks

#### `event`

Triggered for all system events.

```typescript
"event": async ({ event }) => {
  console.log("System event:", event.type, event.data);

  // React to specific events
  if (event.type === "session.start") {
    console.log("New session started:", event.data.sessionID);
  }
}
```

## Plugin Input Context

Each plugin receives a context object with:

```typescript
interface PluginInput {
  client: KuuzukiClient; // HTTP client for server communication
  app: App.Info; // Application information and paths
  $: typeof Bun.$; // Bun shell utilities
}
```

### Client API

```typescript
interface KuuzukiClient {
  baseUrl: string; // Server base URL (e.g., "http://localhost:4096")
}
```

### App Information

```typescript
interface App.Info {
  hostname: string;
  git: boolean;
  path: {
    config: string;   // Configuration directory
    data: string;     // Data directory
    root: string;     // Project root
    cwd: string;      // Current working directory
    state: string;    // State directory
  };
  time: {
    initialized?: number;  // App initialization timestamp
  };
}
```

## Advanced Plugin Patterns

### State Management

```javascript
export const statefulPlugin = async ({ app }) => {
  const state = {
    messageCount: 0,
    userPreferences: new Map(),
  };

  return {
    "chat.message": async (input, output) => {
      state.messageCount++;
      output.parts.forEach((part) => {
        part.metadata = {
          ...part.metadata,
          messageNumber: state.messageCount,
        };
      });
    },
  };
};
```

### Conditional Logic

```javascript
export const conditionalPlugin = async ({ app }) => {
  return {
    "chat.params": async (input, output) => {
      const content = input.message.content.toLowerCase();

      // Adjust parameters based on content
      if (content.includes("code") || content.includes("programming")) {
        output.temperature = 0.3; // More focused for coding
      } else if (content.includes("creative") || content.includes("story")) {
        output.temperature = 0.8; // More creative for writing
      }
    },
  };
};
```

### Tool Integration

```javascript
export const toolEnhancementPlugin = async ({ app, $ }) => {
  return {
    "tool.execute.before": async (input, output) => {
      // Add safety checks
      if (input.tool === "bash" && output.args.command?.includes("rm")) {
        console.log("⚠️  Destructive command detected, adding confirmation");
        output.args.confirm = true;
      }
    },

    "tool.execute.after": async (input, output) => {
      // Enhance output formatting
      if (input.tool === "bash") {
        output.title = `🔧 ${output.title}`;
      }
    },
  };
};
```

## Plugin Metadata

Use the `definePlugin` helper for rich metadata:

```javascript
import { definePlugin } from "@kuuzuki/plugin";

export const MyPlugin = definePlugin(
  {
    name: "my-plugin",
    version: "1.2.0",
    description: "Enhances kuuzuki with awesome features",
    author: "Your Name <email@example.com>",
    homepage: "https://github.com/yourname/kuuzuki-plugin",
    keywords: ["enhancement", "productivity"],
    kuuzukiVersion: ">=0.1.0",
    dependencies: {
      "some-package": "^1.0.0",
    },
  },
  async ({ client, app }) => {
    // Plugin implementation
    return {
      // Your hooks here
    };
  },
);
```

## Error Handling

Plugins should handle errors gracefully:

```javascript
export const robustPlugin = async ({ app }) => {
  return {
    "chat.message": async (input, output) => {
      try {
        // Your plugin logic
        output.parts.forEach((part) => {
          part.metadata = { ...part.metadata, enhanced: true };
        });
      } catch (error) {
        console.error("Plugin error:", error);
        // Don't throw - let the system continue
      }
    },
  };
};
```

## Testing Plugins

### Unit Testing

```javascript
// my-plugin.test.js
import { test, expect } from "bun:test";
import { myPlugin } from "./my-plugin.js";

test("plugin should enhance chat messages", async () => {
  const hooks = await myPlugin({
    client: { baseUrl: "http://localhost:4096" },
    app: { path: { root: "/test" } },
    $: Bun.$,
  });

  const input = {};
  const output = { message: { id: "test" }, parts: [{ metadata: {} }] };

  await hooks["chat.message"](input, output);

  expect(output.parts[0].metadata.enhanced).toBe(true);
});
```

### Integration Testing

```javascript
// Add to .agentrc for testing
{
  "plugin": ["./test/my-plugin.js"]
}
```

## Best Practices

### 1. Performance

- Keep hook execution fast (< 100ms)
- Avoid blocking operations in hooks
- Use async/await properly

### 2. Error Handling

- Never throw errors from hooks
- Log errors for debugging
- Provide fallback behavior

### 3. State Management

- Keep plugin state minimal
- Use immutable updates where possible
- Clean up resources on shutdown

### 4. Compatibility

- Test with different kuuzuki versions
- Handle missing properties gracefully
- Document version requirements

### 5. Security

- Validate all inputs
- Don't expose sensitive data
- Follow principle of least privilege

## Plugin Distribution

### NPM Package Development ✨ **NEW**

kuuzuki now supports automatic npm package installation for plugins, making distribution and sharing much easier.

#### Package Structure

```json
{
  "name": "@yourname/kuuzuki-plugin-name",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["kuuzuki", "plugin"],
  "peerDependencies": {
    "@kuuzuki/plugin": "^1.0.0"
  },
  "files": ["dist"],
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

#### Publishing Your Plugin

```bash
# Build your plugin
npm run build

# Publish to npm
npm publish

# Users can now install with:
# npm install @yourname/kuuzuki-plugin-name
```

#### Using NPM Plugins

Users can now load plugins directly from npm without manual installation:

```json
{
  "plugin": [
    "@yourname/kuuzuki-plugin-name", // Latest version
    "@yourname/kuuzuki-plugin-name@1.2.3", // Specific version
    "simple-plugin-name@latest", // Regular package
    "@kuuzuki/official-logger@beta" // Pre-release versions
  ]
}
```

**Automatic Installation**: kuuzuki will automatically download and install npm packages when they're referenced in the plugin configuration.

### Local Development

```bash
# Link for local development
npm link
npm link @yourname/kuuzuki-plugin-name

# Add to .agentrc
{
  "plugin": ["@yourname/kuuzuki-plugin-name"]
}
```

### Plugin Loading Priority

kuuzuki loads plugins in this order:

1. **NPM packages** - `package-name@version` or `@scope/package@version`
2. **File URLs** - `file:///absolute/path/plugin.js`
3. **Relative paths** - `./plugins/my-plugin.js`
4. **Absolute paths** - `/absolute/path/plugin.js`

## Examples

See the example plugins in `packages/kuuzuki-plugin/src/example.ts`:

- **LoggerPlugin**: Comprehensive logging of all system events
- **PermissionAuditPlugin**: Security auditing and auto-approval
- **ChatEnhancementPlugin**: Dynamic AI parameter adjustment

## Troubleshooting

### Plugin Not Loading

- Check file path in `.agentrc`
- Verify plugin exports are correct
- Check console for error messages

### Hooks Not Triggering

- Verify hook names match exactly
- Check that hooks return promises
- Ensure plugin is loaded successfully

### Performance Issues

- Profile hook execution time
- Avoid synchronous operations
- Use efficient data structures

## Community

- Share plugins on GitHub with `kuuzuki-plugin` topic
- Join discussions in kuuzuki community
- Contribute examples and improvements

## API Reference

For complete API documentation, see the TypeScript definitions in `@kuuzuki/plugin`.

# @kuuzuki/plugin

[![npm version](https://img.shields.io/npm/v/@kuuzuki/plugin.svg)](https://www.npmjs.com/package/@kuuzuki/plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Plugin system for kuuzuki - AI-powered terminal assistant.

**Version**: 0.1.31

## What is this?

The `@kuuzuki/plugin` package provides the core interfaces and types for developing kuuzuki plugins. Plugins can extend kuuzuki's functionality by hooking into various system events and operations.

## Installation

```bash
npm install @kuuzuki/plugin
```

## Quick Start

Create a simple plugin:

```typescript
import { definePlugin } from '@kuuzuki/plugin';

export const MyPlugin = definePlugin(
  {
    name: 'my-plugin',
    version: '1.0.0',
    description: 'My awesome kuuzuki plugin',
    author: 'Your Name',
  },
  async ({ app, client, $ }) => {
    console.log(`Plugin initialized for ${app.path.root}`);
    
    return {
      // Hook into chat messages
      'chat.message': async (_input, output) => {
        console.log(`New message: ${output.message.content}`);
      },
      
      // Hook into tool executions
      'tool.execute.after': async (input, output) => {
        console.log(`Tool ${input.tool} completed: ${output.title}`);
      },
    };
  }
);
```

## Available Hooks

### Event Hooks

- **`event`** - Global event hook, receives all system events
- **`chat.message`** - Called when new chat messages are received
- **`chat.params`** - Modify LLM parameters before generation
- **`permission.ask`** - Custom permission logic
- **`tool.execute.before`** - Modify tool arguments before execution
- **`tool.execute.after`** - Process tool results after execution

### Hook Examples

#### Chat Parameter Modification

```typescript
'chat.params': async (input, output) => {
  // Increase temperature for creative tasks
  if (input.message.content.includes('creative')) {
    output.temperature = 0.9;
  }
}
```

#### Permission Control

```typescript
'permission.ask': async (input, output) => {
  // Auto-deny dangerous commands
  if (input.pattern?.includes('rm -rf')) {
    output.status = 'deny';
  }
}
```

#### Tool Result Processing

```typescript
'tool.execute.after': async (input, output) => {
  // Log all bash commands
  if (input.tool === 'bash') {
    console.log(`Executed: ${output.title}`);
  }
}
```

## Plugin Input

When your plugin is initialized, it receives:

```typescript
interface PluginInput {
  client: KuuzukiClient;  // API client for kuuzuki server
  app: App;               // App context and paths
  $: typeof $;            // Bun shell utility
}
```

## Core Types

### App Context

```typescript
interface App {
  hostname: string;
  git: boolean;
  path: {
    config: string;   // Config directory
    data: string;     // Data directory  
    root: string;     // Project root
    cwd: string;      // Current working directory
    state: string;    // State directory
  };
  time: {
    initialized?: number;
  };
}
```

### User Message

```typescript
interface UserMessage {
  id: string;
  role: "user";
  content: string;
  sessionID: string;
  time: {
    created: number;
  };
}
```

### Permission

```typescript
interface Permission {
  id: string;
  type: string;
  pattern?: string;
  status: "ask" | "allow" | "deny";
  metadata?: Record<string, any>;
}
```

## Example Plugins

The package includes several example plugins:

### Logger Plugin

Logs all system events and tool executions:

```typescript
import { ExamplePlugins } from '@kuuzuki/plugin/src/example';

const { LoggerPlugin } = ExamplePlugins;
```

### Permission Audit Plugin

Tracks and audits all permission requests:

```typescript
const { PermissionAuditPlugin } = ExamplePlugins;
```

### Chat Enhancement Plugin

Dynamically adjusts chat parameters based on content:

```typescript
const { ChatEnhancementPlugin } = ExamplePlugins;
```

## Error Handling

The plugin system provides specific error types:

```typescript
import { PluginError, PluginLoadError, PluginExecutionError } from '@kuuzuki/plugin';

try {
  // Plugin code
} catch (error) {
  if (error instanceof PluginError) {
    console.error(`Plugin ${error.pluginName} failed: ${error.message}`);
  }
}
```

## Best Practices

### 1. Use Metadata

Always provide comprehensive metadata:

```typescript
definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  description: 'Clear description of what your plugin does',
  author: 'Your Name',
  homepage: 'https://github.com/yourname/kuuzuki-plugin-name',
  keywords: ['kuuzuki', 'plugin', 'your-domain'],
}, /* ... */);
```

### 2. Handle Errors Gracefully

```typescript
'tool.execute.after': async (input, output) => {
  try {
    // Your plugin logic
  } catch (error) {
    console.error(`Plugin error in ${input.tool}:`, error);
    // Don't throw - let kuuzuki continue
  }
}
```

### 3. Be Selective with Hooks

Only implement hooks you actually need:

```typescript
// Good - only hooks you use
return {
  'chat.message': async (input, output) => { /* ... */ },
};

// Avoid - empty hooks add overhead
return {
  'chat.message': async (input, output) => { /* ... */ },
  'tool.execute.before': async () => {}, // Empty hook
};
```

### 4. Respect Performance

Avoid heavy operations in frequently called hooks:

```typescript
// Good - lightweight logging
'chat.message': async (input, output) => {
  console.log(`Message: ${output.message.id}`);
}

// Avoid - heavy processing on every message
'chat.message': async (input, output) => {
  await heavyDatabaseOperation(output.message);
}
```

## Plugin Development

### Local Development

1. Clone the kuuzuki repository
2. Navigate to `packages/kuuzuki-plugin`
3. Make your changes
4. Test with the example plugins

### Publishing

1. Build your plugin: `npm run build`
2. Test thoroughly with kuuzuki
3. Publish to npm: `npm publish`

## Integration with kuuzuki

Plugins are loaded by kuuzuki automatically when:

1. Installed as npm packages with `kuuzuki-plugin-` prefix
2. Placed in the kuuzuki plugins directory
3. Configured in kuuzuki settings

See the main kuuzuki documentation for plugin installation and configuration.

## Contributing

We welcome plugin contributions! Whether it's:

- New plugin ideas and implementations
- Improvements to the plugin system
- Better documentation and examples
- Bug fixes and performance improvements

See the main kuuzuki repository for contribution guidelines.

## Links

- [kuuzuki main package](https://www.npmjs.com/package/kuuzuki)
- [GitHub repository](https://github.com/moikas-code/kuuzuki)
- [Plugin examples](https://github.com/moikas-code/kuuzuki/tree/master/packages/kuuzuki-plugin/src)
- [Issues and feature requests](https://github.com/moikas-code/kuuzuki/issues)

## License

MIT

---

Part of the kuuzuki ecosystem - AI-powered terminal assistant.
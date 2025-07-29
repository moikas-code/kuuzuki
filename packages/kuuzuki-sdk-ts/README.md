# Kuuzuki TypeScript SDK

[![NPM version](https://img.shields.io/npm/v/@moikas/kuuzuki-sdk.svg)](https://npmjs.org/package/@moikas/kuuzuki-sdk)

This library provides convenient access to the Kuuzuki REST API from TypeScript or JavaScript.

Generated from the OpenAPI specification using OpenAPI Generator.

## Installation

```bash
npm install @moikas/kuuzuki-sdk
```

## Usage

```typescript
import { Configuration, DefaultApi } from '@moikas/kuuzuki-sdk';

// Configure API client
const config = new Configuration({
  basePath: 'http://localhost:4096',
  // Add authentication if needed
});

const api = new DefaultApi(config);

// Example: List sessions
const sessions = await api.sessionList();
console.log(sessions);

// Example: Create a new session
const session = await api.sessionCreate({
  createSessionRequest: {
    mode: 'chat',
    model: 'claude-3-5-sonnet-20241022'
  }
});
```

## API Documentation

This SDK is generated from the Kuuzuki OpenAPI specification. For detailed API documentation, please refer to the main project documentation.

## Development

To regenerate this SDK from the OpenAPI spec:

```bash
# From the project root
npm run generate-sdks
```

## License

MIT - See LICENSE file in the root repository
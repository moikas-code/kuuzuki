# Test Directory

This directory contains root-level test files and scripts for the kuuzuki project.

## 📁 Directory Structure

### `/config/` - Test Configuration Files

- [`agentrc.test`](config/agentrc.test) - Test configuration for agent settings

### `/scripts/` - Test Scripts

- [`final-test.sh`](scripts/final-test.sh) - Comprehensive final testing script
- [`test-spawn.ts`](scripts/test-spawn.ts) - Test spawn functionality
- [`test-tui.sh`](scripts/test-tui.sh) - Terminal UI testing script
- [`debug-tui.sh`](scripts/debug-tui.sh) - TUI debugging utilities

### Root Level Test Files

- [`tool-fallback.test.ts`](tool-fallback.test.ts) - Tool fallback system comprehensive tests
- [`session-integration.test.ts`](session-integration.test.ts) - Session integration tests for tool fallback
- [`session-tools.test.ts`](session-tools.test.ts) - Session tool registration and execution tests

## 🧪 Package-Level Tests

Individual packages have their own test directories:

- **`packages/kuuzuki/test/`** - Core kuuzuki functionality tests

  - Tool tests (`tool/`)
  - Session tests (`session/`)
  - Provider tests (`provider/`)
  - Utility tests (`util/`)
  - Performance tests (`performance/`)

- **`packages/tui/`** - Go TUI tests (various `*_test.go` files)
  - SDK tests (`sdk/`)
  - Input handling tests (`input/`)
  - Component tests (`internal/components/`)

## 🚀 Running Tests

### Root Level Tests

```bash
# Run comprehensive final test
./test/scripts/final-test.sh

# Test TUI functionality
./test/scripts/test-tui.sh

# Debug TUI issues
./test/scripts/debug-tui.sh

# Test spawn functionality
bun run test/scripts/test-spawn.ts

# Run tool fallback system tests
bun run test/tool-fallback.test.ts

# Run session integration tests
bun run test/session-integration.test.ts

# Run session tools tests
bun run test/session-tools.test.ts
```

### Package Tests

```bash
# Run all kuuzuki tests
cd packages/kuuzuki && bun test

# Run specific test file
cd packages/kuuzuki && bun test tool/edit.test.ts

# Run Go TUI tests
cd packages/tui && go test ./...
```

## 📋 Test Categories

### Integration Tests

- End-to-end functionality testing
- TUI and server communication
- API key management flows
- Tool fallback system integration
- Session tool registration and execution

### Unit Tests

- Individual tool functionality
- Session management
- Provider abstractions
- Utility functions

### Performance Tests

- Memory usage monitoring
- Response time benchmarks
- Resource utilization

## 🔧 Test Configuration

Test configurations are stored in the `/config/` directory:

- Agent configurations for testing environments
- Mock data and fixtures
- Test-specific environment variables

## 📖 Documentation Tests

Test documentation is located in `docs/testing/`:

- API key flow testing procedures
- Stripe webhook testing guides
- Integration testing workflows

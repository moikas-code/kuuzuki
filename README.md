# kuuzuki

[![npm version](https://badge.fury.io/js/kuuzuki.svg)](https://www.npmjs.com/package/kuuzuki)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AI coding agent for the terminal. A community fork of [OpenCode](https://github.com/sst/opencode) with reliability improvements.

**Version**: 0.1.19

## Philosophy

Code is conversation. Between you and the machine, between you and your future self, between you and your collaborators. kuuzuki facilitates this conversation by bringing AI assistance directly into your terminal workflow.

We believe tools should be:

- **Reliable** - They work when you need them
- **Honest** - They tell you what they can and cannot do
- **Respectful** - They don't waste your time or attention
- **Simple** - They solve problems without creating new ones

## What is this?

kuuzuki brings AI assistance into your terminal environment. Instead of context-switching to web interfaces, you can:

- Analyze code and understand complex systems
- Debug errors with contextual assistance
- Generate code that fits your existing patterns
- Refactor with confidence and clarity
- Learn new concepts through guided exploration

The AI has access to your files and can perform operations, making it a true coding partner rather than just a chat interface.

## How this differs from OpenCode

We took the solid foundation of OpenCode and focused on **reliability engineering**:

- **Graceful degradation** - When tools are unavailable, the system adapts rather than failing
- **Comprehensive testing** - Automated verification of core functionality
- **Accessible distribution** - Available through standard package managers
- **Transparent operation** - Clear about capabilities and limitations

This is not about being "better" - it's about being **dependable**.

## How do I use it?

### 1. Install it

```bash
npm install -g kuuzuki
```

### 2. Get an API key

You need an Anthropic API key (Claude's company). Go to [console.anthropic.com](https://console.anthropic.com), make an account, and get a key. It costs money but not much for casual use. You can use your Claude Code as well.

```bash
export ANTHROPIC_API_KEY="your-key-here"
```

### 3. Start using it

```bash
# Start the interactive mode (recommended for beginners)
kuuzuki

# Or run a quick command
kuuzuki run "explain what this error means: permission denied"

# Or run it as a server (for advanced users)
kuuzuki serve
```

## What can it do?

- **Read your files**: It can look at your code and explain what it does
- **Debug problems**: Paste an error message and get help figuring it out
- **Write code**: Ask it to generate functions, fix bugs, or add features
- **Explain things**: Don't understand a command or concept? Just ask
- **File operations**: It can create, edit, and organize files for you

## How to use the interactive mode

When you run `kuuzuki`, you get a chat interface in your terminal:

- Press `i` to start typing your question
- Press `Enter` to send it
- Press `Esc` to stop typing
- Use `j` and `k` to scroll up and down (like vim)
- Press `Ctrl+D` to quit

## What works where?

- **macOS**: Works great
- **Linux**: Works great
- **Windows**: Should work but we test it less

## Common problems

**"Command not found"**: Make sure you installed it globally with `-g`

**"API key not found"**: Make sure you set the `ANTHROPIC_API_KEY` environment variable

**"It's slow"**: The AI takes time to think. Faster responses cost more money.

**"It crashed"**: Try updating to the latest version. We fixed a lot of crashes.

## Contributing

Unlike some projects, kuuzuki welcomes contributions of all kinds. We believe good ideas can come from anywhere.

**What we accept:**

- Core feature improvements and new features
- Bug fixes and reliability improvements
- Performance optimizations
- Documentation improvements
- New tool integrations and MCP servers
- UI/UX enhancements
- Platform-specific fixes
- Tests and quality improvements

**Our approach:**

- **Open discussion** - Propose ideas in issues before big changes
- **Collaborative design** - We'll work together to find the best solution
- **Learning together** - New contributors are mentored, not gatekept
- **Respectful review** - Code review focuses on improvement, not criticism

The best contributions often come from people actually using the tool and finding pain points we missed.

## For developers

This is a monorepo with several parts:

- `packages/kuuzuki/` - Main TypeScript CLI and server
- `packages/tui/` - Go-based terminal interface
- `packages/web/` - Web interface (if you want to run it in a browser)

**Getting started:**

```bash
git clone https://github.com/moikas-code/kuuzuki.git
cd kuuzuki
bun install
./run.sh build all
```

See something that could be better? Open an issue or submit a PR. We're here to help make it happen.

## Community Philosophy

This project exists because we believe:

- **Tools should serve users**, not the other way around
- **Community wisdom** often exceeds individual insight
- **Diverse perspectives** create more robust solutions
- **Open development** leads to better software
- **Helping each other** is more valuable than protecting territory

We're building something useful together. Your experience and ideas matter.

## License

MIT

## Links

- [npm](https://www.npmjs.com/package/kuuzuki)
- [github](https://github.com/moikas-code/kuuzuki)
- [discussions](https://github.com/moikas-code/kuuzuki/discussions) - Share ideas and get help
- [issues](https://github.com/moikas-code/kuuzuki/issues) - Report bugs or request features

Fork of [OpenCode](https://github.com/sst/opencode) by SST, with a different philosophy about community and contribution.

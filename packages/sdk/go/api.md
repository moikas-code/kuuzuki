# Shared Response Types

- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go/shared">shared</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go/shared#MessageAbortedError">MessageAbortedError</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go/shared">shared</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go/shared#ProviderAuthError">ProviderAuthError</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go/shared">shared</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go/shared#UnknownError">UnknownError</a>

# Event

Response Types:

- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#EventListResponse">EventListResponse</a>

Methods:

- <code title="get /event">client.Event.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#EventService.List">List</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>) (<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#EventListResponse">EventListResponse</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>

# App

Response Types:

- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Agent">Agent</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#App">App</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Model">Model</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Provider">Provider</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#AppProvidersResponse">AppProvidersResponse</a>

Methods:

- <code title="get /agent">client.App.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#AppService.Agents">Agents</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>) ([]<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Agent">Agent</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="get /app">client.App.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#AppService.Get">Get</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>) (<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#App">App</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="post /app/init">client.App.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#AppService.Init">Init</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>) (<a href="https://pkg.go.dev/builtin#bool">bool</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="post /log">client.App.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#AppService.Log">Log</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, body <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#AppLogParams">AppLogParams</a>) (<a href="https://pkg.go.dev/builtin#bool">bool</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="get /config/providers">client.App.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#AppService.Providers">Providers</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>) (<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#AppProvidersResponse">AppProvidersResponse</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>

# Find

Response Types:

- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Symbol">Symbol</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FindTextResponse">FindTextResponse</a>

Methods:

- <code title="get /find/file">client.Find.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FindService.Files">Files</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, query <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FindFilesParams">FindFilesParams</a>) ([]<a href="https://pkg.go.dev/builtin#string">string</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="get /find/symbol">client.Find.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FindService.Symbols">Symbols</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, query <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FindSymbolsParams">FindSymbolsParams</a>) ([]<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Symbol">Symbol</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="get /find">client.Find.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FindService.Text">Text</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, query <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FindTextParams">FindTextParams</a>) ([]<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FindTextResponse">FindTextResponse</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>

# File

Response Types:

- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#File">File</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FileReadResponse">FileReadResponse</a>

Methods:

- <code title="get /file">client.File.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FileService.Read">Read</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, query <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FileReadParams">FileReadParams</a>) (<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FileReadResponse">FileReadResponse</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="get /file/status">client.File.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FileService.Status">Status</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>) ([]<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#File">File</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>

# Config

Response Types:

- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Config">Config</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#KeybindsConfig">KeybindsConfig</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#McpLocalConfig">McpLocalConfig</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#McpRemoteConfig">McpRemoteConfig</a>

Methods:

- <code title="get /config">client.Config.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#ConfigService.Get">Get</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>) (<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Config">Config</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>

# Session

Params Types:

- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#AgentPartInputParam">AgentPartInputParam</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FilePartInputParam">FilePartInputParam</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FilePartSourceUnionParam">FilePartSourceUnionParam</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FilePartSourceTextParam">FilePartSourceTextParam</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FileSourceParam">FileSourceParam</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SymbolSourceParam">SymbolSourceParam</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#TextPartInputParam">TextPartInputParam</a>

Response Types:

- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#AgentPart">AgentPart</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#AssistantMessage">AssistantMessage</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FilePart">FilePart</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FilePartSource">FilePartSource</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FilePartSourceText">FilePartSourceText</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#FileSource">FileSource</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Message">Message</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Part">Part</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Session">Session</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SnapshotPart">SnapshotPart</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#StepFinishPart">StepFinishPart</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#StepStartPart">StepStartPart</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SymbolSource">SymbolSource</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#TextPart">TextPart</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#ToolPart">ToolPart</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#ToolStateCompleted">ToolStateCompleted</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#ToolStateError">ToolStateError</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#ToolStatePending">ToolStatePending</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#ToolStateRunning">ToolStateRunning</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#UserMessage">UserMessage</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionMessageResponse">SessionMessageResponse</a>
- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionMessagesResponse">SessionMessagesResponse</a>

Methods:

- <code title="post /session">client.Session.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionService.New">New</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>) (<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Session">Session</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="get /session">client.Session.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionService.List">List</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>) ([]<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Session">Session</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="delete /session/{id}">client.Session.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionService.Delete">Delete</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, id <a href="https://pkg.go.dev/builtin#string">string</a>) (<a href="https://pkg.go.dev/builtin#bool">bool</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="post /session/{id}/abort">client.Session.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionService.Abort">Abort</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, id <a href="https://pkg.go.dev/builtin#string">string</a>) (<a href="https://pkg.go.dev/builtin#bool">bool</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="post /session/{id}/message">client.Session.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionService.Chat">Chat</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, id <a href="https://pkg.go.dev/builtin#string">string</a>, body <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionChatParams">SessionChatParams</a>) (<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#AssistantMessage">AssistantMessage</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="post /session/{id}/init">client.Session.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionService.Init">Init</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, id <a href="https://pkg.go.dev/builtin#string">string</a>, body <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionInitParams">SessionInitParams</a>) (<a href="https://pkg.go.dev/builtin#bool">bool</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="get /session/{id}/message/{messageID}">client.Session.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionService.Message">Message</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, id <a href="https://pkg.go.dev/builtin#string">string</a>, messageID <a href="https://pkg.go.dev/builtin#string">string</a>) (<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionMessageResponse">SessionMessageResponse</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="get /session/{id}/message">client.Session.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionService.Messages">Messages</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, id <a href="https://pkg.go.dev/builtin#string">string</a>) ([]<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionMessagesResponse">SessionMessagesResponse</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="post /session/{id}/revert">client.Session.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionService.Revert">Revert</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, id <a href="https://pkg.go.dev/builtin#string">string</a>, body <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionRevertParams">SessionRevertParams</a>) (<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Session">Session</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="post /session/{id}/share">client.Session.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionService.Share">Share</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, id <a href="https://pkg.go.dev/builtin#string">string</a>) (<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Session">Session</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="post /session/{id}/summarize">client.Session.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionService.Summarize">Summarize</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, id <a href="https://pkg.go.dev/builtin#string">string</a>, body <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionSummarizeParams">SessionSummarizeParams</a>) (<a href="https://pkg.go.dev/builtin#bool">bool</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="post /session/{id}/unrevert">client.Session.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionService.Unrevert">Unrevert</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, id <a href="https://pkg.go.dev/builtin#string">string</a>) (<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Session">Session</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="delete /session/{id}/share">client.Session.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionService.Unshare">Unshare</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, id <a href="https://pkg.go.dev/builtin#string">string</a>) (<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Session">Session</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>

## Permissions

Response Types:

- <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#Permission">Permission</a>

Methods:

- <code title="post /session/{id}/permissions/{permissionID}">client.Session.Permissions.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionPermissionService.Respond">Respond</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, id <a href="https://pkg.go.dev/builtin#string">string</a>, permissionID <a href="https://pkg.go.dev/builtin#string">string</a>, body <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#SessionPermissionRespondParams">SessionPermissionRespondParams</a>) (<a href="https://pkg.go.dev/builtin#bool">bool</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>

# Tui

Methods:

- <code title="post /tui/append-prompt">client.Tui.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#TuiService.AppendPrompt">AppendPrompt</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, body <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#TuiAppendPromptParams">TuiAppendPromptParams</a>) (<a href="https://pkg.go.dev/builtin#bool">bool</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="post /tui/clear-prompt">client.Tui.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#TuiService.ClearPrompt">ClearPrompt</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>) (<a href="https://pkg.go.dev/builtin#bool">bool</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="post /tui/execute-command">client.Tui.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#TuiService.ExecuteCommand">ExecuteCommand</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>, body <a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go">kuuzuki</a>.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#TuiExecuteCommandParams">TuiExecuteCommandParams</a>) (<a href="https://pkg.go.dev/builtin#bool">bool</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="post /tui/open-help">client.Tui.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#TuiService.OpenHelp">OpenHelp</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>) (<a href="https://pkg.go.dev/builtin#bool">bool</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="post /tui/open-models">client.Tui.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#TuiService.OpenModels">OpenModels</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>) (<a href="https://pkg.go.dev/builtin#bool">bool</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="post /tui/open-sessions">client.Tui.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#TuiService.OpenSessions">OpenSessions</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>) (<a href="https://pkg.go.dev/builtin#bool">bool</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="post /tui/open-themes">client.Tui.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#TuiService.OpenThemes">OpenThemes</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>) (<a href="https://pkg.go.dev/builtin#bool">bool</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>
- <code title="post /tui/submit-prompt">client.Tui.<a href="https://pkg.go.dev/github.com/sst/kuuzuki-sdk-go#TuiService.SubmitPrompt">SubmitPrompt</a>(ctx <a href="https://pkg.go.dev/context">context</a>.<a href="https://pkg.go.dev/context#Context">Context</a>) (<a href="https://pkg.go.dev/builtin#bool">bool</a>, <a href="https://pkg.go.dev/builtin#error">error</a>)</code>

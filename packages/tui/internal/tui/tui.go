package tui

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"slices"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/v2/key"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"

	opencode "github.com/sst/opencode-sdk-go"
	"github.com/sst/opencode/internal/api"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/commands"
	"github.com/sst/opencode/internal/completions"
	"github.com/sst/opencode/internal/components/chat"
	cmdcomp "github.com/sst/opencode/internal/components/commands"
	"github.com/sst/opencode/internal/components/dialog"
	"github.com/sst/opencode/internal/components/fileviewer"
	"github.com/sst/opencode/internal/components/modal"
	"github.com/sst/opencode/internal/components/status"
	"github.com/sst/opencode/internal/components/toast"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
)

// InterruptDebounceTimeoutMsg is sent when the interrupt key debounce timeout expires
type InterruptDebounceTimeoutMsg struct{}

// ExitDebounceTimeoutMsg is sent when the exit key debounce timeout expires
type ExitDebounceTimeoutMsg struct{}

// FocusDetectionTimeoutMsg is sent when focus detection timeout expires
type FocusDetectionTimeoutMsg struct{}

// InterruptKeyState tracks the state of interrupt key presses for debouncing
type InterruptKeyState int

// ExitKeyState tracks the state of exit key presses for debouncing
type ExitKeyState int

const (
	InterruptKeyIdle InterruptKeyState = iota
	InterruptKeyFirstPress
)

const (
	ExitKeyIdle ExitKeyState = iota
	ExitKeyFirstPress
)

const interruptDebounceTimeout = 1 * time.Second
const exitDebounceTimeout = 1 * time.Second
const focusDetectionTimeout = 3 * time.Second

type Model struct {
	width, height        int
	app                  *app.App
	modal                layout.Modal
	status               status.StatusComponent
	editor               chat.EditorComponent
	messages             chat.MessagesComponent
	completions          dialog.CompletionDialog
	commandProvider      completions.CompletionProvider
	fileProvider         completions.CompletionProvider
	symbolsProvider      completions.CompletionProvider
	showCompletionDialog bool
	leaderBinding        *key.Binding
	// isLeaderSequence     bool
	toastManager        *toast.ToastManager
	interruptKeyState   InterruptKeyState
	exitKeyState        ExitKeyState
	messagesRight       bool
	fileViewer          fileviewer.Model
	pendingConfirmation *chat.ConfirmationMsg
	activeConfirmation  *chat.ConfirmationMessage
	activeToolApproval  *chat.ToolApprovalMessage
	activeTextInput     *chat.TextInputMessage
	// Focus state tracking for multi-instance drag-and-drop filtering
	hasFocus       bool
	focusSupported bool
}

func (a Model) Init() tea.Cmd {
	var cmds []tea.Cmd
	// https://github.com/charmbracelet/bubbletea/issues/1440
	// https://github.com/sst/opencode/issues/127
	if !util.IsWsl() {
		cmds = append(cmds, tea.RequestBackgroundColor)
	}

	// Enable focus reporting for multi-instance drag-and-drop filtering
	cmds = append(cmds, tea.EnableReportFocus)

	// Set timeout to detect if focus events are supported
	cmds = append(cmds, tea.Tick(focusDetectionTimeout, func(time.Time) tea.Msg {
		return FocusDetectionTimeoutMsg{}
	}))

	cmds = append(cmds, a.app.InitializeProvider())
	cmds = append(cmds, a.editor.Init())
	cmds = append(cmds, a.messages.Init())
	cmds = append(cmds, a.status.Init())
	cmds = append(cmds, a.completions.Init())
	cmds = append(cmds, a.toastManager.Init())
	cmds = append(cmds, a.fileViewer.Init())

	// Check if we should show the init dialog
	cmds = append(cmds, func() tea.Msg {
		shouldShow := a.app.Info.Git && a.app.Info.Time.Initialized > 0
		return dialog.ShowInitDialogMsg{Show: shouldShow}
	})

	return tea.Batch(cmds...)
}

func (a Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	measure := util.Measure("app.Update")
	defer measure("from", fmt.Sprintf("%T", msg))

	var cmd tea.Cmd
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyPressMsg:
		keyString := msg.String()

		// 1. Handle active modal
		if a.modal != nil {
			// Always pass key presses to the modal first to let it handle its own logic
			updatedModal, cmd := a.modal.Update(msg)
			a.modal = updatedModal.(layout.Modal)

			// If the modal returned a command, execute it
			if cmd != nil {
				return a, cmd
			}

			// Handle ctrl+c as a fallback to force close modal
			if keyString == "ctrl+c" {
				cmd = a.modal.Close()
				a.modal = nil
				return a, cmd
			}

			// Return the updated modal state
			return a, nil
		}

		// Handle active confirmation
		if a.activeConfirmation != nil {
			updated, cmd := a.activeConfirmation.Update(msg)
			a.activeConfirmation = updated
			if cmd != nil {
				return a, cmd
			}
			return a, nil
		}

		// Handle active tool approval
		if a.activeToolApproval != nil {
			updated, cmd := a.activeToolApproval.Update(msg)
			a.activeToolApproval = updated
			if cmd != nil {
				return a, cmd
			}
			return a, nil
		}

		// Handle active text input
		if a.activeTextInput != nil {
			updated, cmd := a.activeTextInput.Update(msg)
			a.activeTextInput = updated
			if cmd != nil {
				return a, cmd
			}
			return a, nil
		}

		// 2. Check for commands that require leader
		if a.app.IsLeaderSequence {
			matches := a.app.Commands.Matches(msg, a.app.IsLeaderSequence)
			a.app.IsLeaderSequence = false
			if len(matches) > 0 {
				return a, util.CmdHandler(commands.ExecuteCommandsMsg(matches))
			}
		}

		// 3. Handle completions trigger
		if keyString == "/" &&
			!a.showCompletionDialog &&
			a.editor.Value() == "" {
			a.showCompletionDialog = true

			updated, cmd := a.editor.Update(msg)
			a.editor = updated.(chat.EditorComponent)
			cmds = append(cmds, cmd)

			// Set command provider for command completion
			a.completions = dialog.NewCompletionDialogComponent("/", a.commandProvider)
			updated, cmd = a.completions.Update(msg)
			a.completions = updated.(dialog.CompletionDialog)
			cmds = append(cmds, cmd)

			return a, tea.Sequence(cmds...)
		}

		// Handle file completions trigger
		if keyString == "@" &&
			!a.showCompletionDialog {
			a.showCompletionDialog = true

			updated, cmd := a.editor.Update(msg)
			a.editor = updated.(chat.EditorComponent)
			cmds = append(cmds, cmd)

			// Set both file and symbols providers for @ completion
			a.completions = dialog.NewCompletionDialogComponent("@", a.fileProvider, a.symbolsProvider)
			updated, cmd = a.completions.Update(msg)
			a.completions = updated.(dialog.CompletionDialog)
			cmds = append(cmds, cmd)

			return a, tea.Sequence(cmds...)
		}

		if a.showCompletionDialog {
			switch keyString {
			case "tab", "enter", "esc", "ctrl+c", "up", "down", "ctrl+p", "ctrl+n":
				updated, cmd := a.completions.Update(msg)
				a.completions = updated.(dialog.CompletionDialog)
				cmds = append(cmds, cmd)
				return a, tea.Batch(cmds...)
			}

			updated, cmd := a.editor.Update(msg)
			a.editor = updated.(chat.EditorComponent)
			cmds = append(cmds, cmd)

			updated, cmd = a.completions.Update(msg)
			a.completions = updated.(dialog.CompletionDialog)
			cmds = append(cmds, cmd)

			return a, tea.Batch(cmds...)
		}

		// 4. Maximize editor responsiveness for printable characters
		if msg.Text != "" {
			updated, cmd := a.editor.Update(msg)
			a.editor = updated.(chat.EditorComponent)
			cmds = append(cmds, cmd)
			return a, tea.Batch(cmds...)
		}

		// 5. Check for leader key activation
		if a.leaderBinding != nil &&
			!a.app.IsLeaderSequence &&
			key.Matches(msg, *a.leaderBinding) {
			a.app.IsLeaderSequence = true
			return a, nil
		}

		// 6 Handle input clear command
		inputClearCommand := a.app.Commands[commands.InputClearCommand]
		if inputClearCommand.Matches(msg, a.app.IsLeaderSequence) && a.editor.Length() > 0 {
			return a, util.CmdHandler(commands.ExecuteCommandMsg(inputClearCommand))
		}

		// 7. Handle interrupt key debounce for session interrupt
		interruptCommand := a.app.Commands[commands.SessionInterruptCommand]
		if interruptCommand.Matches(msg, a.app.IsLeaderSequence) && a.app.IsBusy() {
			switch a.interruptKeyState {
			case InterruptKeyIdle:
				// First interrupt key press - start debounce timer
				a.interruptKeyState = InterruptKeyFirstPress
				a.editor.SetInterruptKeyInDebounce(true)
				return a, tea.Tick(interruptDebounceTimeout, func(t time.Time) tea.Msg {
					return InterruptDebounceTimeoutMsg{}
				})
			case InterruptKeyFirstPress:
				// Second interrupt key press within timeout - actually interrupt
				a.interruptKeyState = InterruptKeyIdle
				a.editor.SetInterruptKeyInDebounce(false)
				return a, util.CmdHandler(commands.ExecuteCommandMsg(interruptCommand))
			}
		}

		// 8. Handle exit key debounce for app exit when using non-leader command
		exitCommand := a.app.Commands[commands.AppExitCommand]
		if exitCommand.Matches(msg, a.app.IsLeaderSequence) {
			switch a.exitKeyState {
			case ExitKeyIdle:
				// First exit key press - start debounce timer
				a.exitKeyState = ExitKeyFirstPress
				a.editor.SetExitKeyInDebounce(true)
				return a, tea.Tick(exitDebounceTimeout, func(t time.Time) tea.Msg {
					return ExitDebounceTimeoutMsg{}
				})
			case ExitKeyFirstPress:
				// Second exit key press within timeout - actually exit
				a.exitKeyState = ExitKeyIdle
				a.editor.SetExitKeyInDebounce(false)
				return a, util.CmdHandler(commands.ExecuteCommandMsg(exitCommand))
			}
		}

		// 9. Check again for commands that don't require leader (excluding interrupt when busy and exit when in debounce)
		matches := a.app.Commands.Matches(msg, a.app.IsLeaderSequence)
		if len(matches) > 0 {
			// Skip interrupt key if we're in debounce mode and app is busy
			if interruptCommand.Matches(msg, a.app.IsLeaderSequence) && a.app.IsBusy() && a.interruptKeyState != InterruptKeyIdle {
				return a, nil
			}
			return a, util.CmdHandler(commands.ExecuteCommandsMsg(matches))
		}

		// Fallback: suspend if ctrl+z is pressed and no user keybind matched
		if keyString == "ctrl+z" {
			return a, tea.Suspend
		}

		// 10. Fallback to editor. This is for other characters like backspace, tab, etc.
		updatedEditor, cmd := a.editor.Update(msg)
		a.editor = updatedEditor.(chat.EditorComponent)
		return a, cmd
	case tea.MouseWheelMsg:
		if a.modal != nil {
			u, cmd := a.modal.Update(msg)
			a.modal = u.(layout.Modal)
			cmds = append(cmds, cmd)
			return a, tea.Batch(cmds...)
		}

		updated, cmd := a.messages.Update(msg)
		a.messages = updated.(chat.MessagesComponent)
		cmds = append(cmds, cmd)
		return a, tea.Batch(cmds...)
	case tea.BackgroundColorMsg:
		styles.Terminal = &styles.TerminalInfo{
			Background:       msg.Color,
			BackgroundIsDark: msg.IsDark(),
		}
		slog.Debug("Background color", "color", msg.String(), "isDark", msg.IsDark())
		return a, func() tea.Msg {
			theme.UpdateSystemTheme(
				styles.Terminal.Background,
				styles.Terminal.BackgroundIsDark,
			)
			return dialog.ThemeSelectedMsg{
				ThemeName: theme.CurrentThemeName(),
			}
		}
	case tea.FocusMsg:
		a.hasFocus = true
		a.focusSupported = true
		a.editor.SetFocusState(a.hasFocus, a.focusSupported)
		slog.Debug("TUI gained focus - drag-and-drop enabled")
		return a, nil
	case tea.BlurMsg:
		a.hasFocus = false
		a.focusSupported = true
		a.editor.SetFocusState(a.hasFocus, a.focusSupported)
		slog.Debug("TUI lost focus - drag-and-drop disabled")
		return a, nil
	case modal.CloseModalMsg:
		a.editor.Focus()
		var cmd tea.Cmd
		if a.modal != nil {
			cmd = a.modal.Close()
		}
		a.modal = nil
		return a, cmd
	case commands.ExecuteCommandMsg:
		updated, cmd := a.executeCommand(commands.Command(msg))
		return updated, cmd
	case commands.ExecuteCommandsMsg:
		for _, command := range msg {
			updated, cmd := a.executeCommand(command)
			if cmd != nil {
				return updated, cmd
			}
		}
	case error:
		return a, toast.NewErrorToast(msg.Error())
	case app.SendPrompt:
		a.showCompletionDialog = false
		a.app, cmd = a.app.SendPrompt(context.Background(), msg)
		cmds = append(cmds, cmd)
	case app.SetEditorContentMsg:
		// Set the editor content without sending
		a.editor.SetValueWithAttachments(msg.Text)
		updated, cmd := a.editor.Focus()
		a.editor = updated.(chat.EditorComponent)
		cmds = append(cmds, cmd)
	case dialog.CompletionDialogCloseMsg:
		a.showCompletionDialog = false
	case opencode.EventListResponseEventInstallationUpdated:
		return a, toast.NewSuccessToast(
			"opencode updated to "+msg.Properties.Version+", restart to apply.",
			toast.WithTitle("New version installed"),
		)
	case opencode.EventListResponseEventIdeInstalled:
		return a, toast.NewSuccessToast(
			"Installed the opencode extension in "+msg.Properties.Ide,
			toast.WithTitle(msg.Properties.Ide+" extension installed"),
		)
	case opencode.EventListResponseEventSessionDeleted:
		if a.app.Session != nil && msg.Properties.Info.ID == a.app.Session.ID {
			a.app.Session = &opencode.Session{}
			a.app.Messages = []app.Message{}
		}
		return a, toast.NewSuccessToast("Session deleted successfully")
	case opencode.EventListResponseEventSessionUpdated:
		if msg.Properties.Info.ID == a.app.Session.ID {
			a.app.Session = &msg.Properties.Info
		}
	case opencode.EventListResponseEventMessagePartUpdated:
		slog.Info("message part updated", "message", msg.Properties.Part.MessageID, "part", msg.Properties.Part.ID)
		if msg.Properties.Part.SessionID == a.app.Session.ID {
			messageIndex := slices.IndexFunc(a.app.Messages, func(m app.Message) bool {
				switch casted := m.Info.(type) {
				case opencode.UserMessage:
					return casted.ID == msg.Properties.Part.MessageID
				case opencode.AssistantMessage:
					return casted.ID == msg.Properties.Part.MessageID
				}
				return false
			})
			if messageIndex > -1 {
				message := a.app.Messages[messageIndex]
				partIndex := slices.IndexFunc(message.Parts, func(p opencode.PartUnion) bool {
					switch casted := p.(type) {
					case opencode.TextPart:
						return casted.ID == msg.Properties.Part.ID
					case opencode.FilePart:
						return casted.ID == msg.Properties.Part.ID
					case opencode.ToolPart:
						return casted.ID == msg.Properties.Part.ID
					case opencode.StepStartPart:
						return casted.ID == msg.Properties.Part.ID
					case opencode.StepFinishPart:
						return casted.ID == msg.Properties.Part.ID
					}
					return false
				})
				if partIndex > -1 {
					message.Parts[partIndex] = msg.Properties.Part.AsUnion()
				}
				if partIndex == -1 {
					message.Parts = append(message.Parts, msg.Properties.Part.AsUnion())
				}
				a.app.Messages[messageIndex] = message
			}
		}
	case opencode.EventListResponseEventMessageUpdated:
		if msg.Properties.Info.SessionID == a.app.Session.ID {
			matchIndex := slices.IndexFunc(a.app.Messages, func(m app.Message) bool {
				switch casted := m.Info.(type) {
				case opencode.UserMessage:
					return casted.ID == msg.Properties.Info.ID
				case opencode.AssistantMessage:
					return casted.ID == msg.Properties.Info.ID
				}
				return false
			})

			if matchIndex > -1 {
				match := a.app.Messages[matchIndex]
				a.app.Messages[matchIndex] = app.Message{
					Info:  msg.Properties.Info.AsUnion(),
					Parts: match.Parts,
				}
			}

			if matchIndex == -1 {
				a.app.Messages = append(a.app.Messages, app.Message{
					Info:  msg.Properties.Info.AsUnion(),
					Parts: []opencode.PartUnion{},
				})
			}
		}
	case opencode.EventListResponseEventSessionError:
		switch err := msg.Properties.Error.AsUnion().(type) {
		case nil:
		case opencode.ProviderAuthError:
			slog.Error("Failed to authenticate with provider", "error", err.Data.Message)
			return a, toast.NewErrorToast("Provider error: " + err.Data.Message)
		case opencode.UnknownError:
			slog.Error("Server error", "name", err.Name, "message", err.Data.Message)
			return a, toast.NewErrorToast(err.Data.Message, toast.WithTitle(string(err.Name)))
		}
	case opencode.EventListResponseEventFileWatcherUpdated:
		if a.fileViewer.HasFile() {
			if a.fileViewer.Filename() == msg.Properties.File {
				return a.openFile(msg.Properties.File)
			}
		}
	case opencode.EventListResponseEventPermissionUpdated:
		// Convert permission event to tool approval message
		cmds = append(cmds, func() tea.Msg {
			return chat.ToolApprovalMsg{
				ID:          msg.Properties.ID,
				ToolName:    msg.Properties.Title,
				Description: "Permission requested",
				Metadata:    msg.Properties.Metadata,
			}
		})
	case tea.WindowSizeMsg:
		msg.Height -= 2 // Make space for the status bar
		a.width, a.height = msg.Width, msg.Height
		container := min(a.width, 86)
		layout.Current = &layout.LayoutInfo{
			Viewport: layout.Dimensions{
				Width:  a.width,
				Height: a.height,
			},
			Container: layout.Dimensions{
				Width: container,
			},
		}
	case app.SessionSelectedMsg:
		messages, err := a.app.ListMessages(context.Background(), msg.ID)
		if err != nil {
			slog.Error("Failed to list messages", "error", err.Error())
			return a, toast.NewErrorToast("Failed to open session")
		}
		a.app.Session = msg
		a.app.Messages = messages
		return a, util.CmdHandler(app.SessionLoadedMsg{})
	case app.SessionCreatedMsg:
		a.app.Session = msg.Session
		return a, util.CmdHandler(app.SessionLoadedMsg{})
	case app.MessageRevertedMsg:
		if msg.Session.ID == a.app.Session.ID {
			a.app.Session = &msg.Session
		}
	case app.ModelSelectedMsg:
		a.app.Provider = &msg.Provider
		a.app.Model = &msg.Model
		a.app.State.ModeModel[a.app.Mode.Name] = app.ModeModel{
			ProviderID: msg.Provider.ID,
			ModelID:    msg.Model.ID,
		}
		a.app.State.UpdateModelUsage(msg.Provider.ID, msg.Model.ID)
		cmds = append(cmds, a.app.SaveState())
	case dialog.ThemeSelectedMsg:
		a.app.State.Theme = msg.ThemeName
		cmds = append(cmds, a.app.SaveState())
	case toast.ShowToastMsg:
		tm, cmd := a.toastManager.Update(msg)
		a.toastManager = tm
		cmds = append(cmds, cmd)
	case toast.DismissToastMsg:
		tm, cmd := a.toastManager.Update(msg)
		a.toastManager = tm
		cmds = append(cmds, cmd)
	case InterruptDebounceTimeoutMsg:
		// Reset interrupt key state after timeout
		a.interruptKeyState = InterruptKeyIdle
		a.editor.SetInterruptKeyInDebounce(false)
	case ExitDebounceTimeoutMsg:
		// Reset exit key state after timeout
		a.exitKeyState = ExitKeyIdle
		a.editor.SetExitKeyInDebounce(false)
	case FocusDetectionTimeoutMsg:
		// If no focus events received within timeout, disable focus filtering
		if !a.focusSupported {
			slog.Debug("Focus detection timeout - disabling focus-based filtering")
			a.focusSupported = false
			a.hasFocus = true // Default to allowing all paste events
			a.editor.SetFocusState(a.hasFocus, a.focusSupported)
		}
	case dialog.FindSelectedMsg:
		return a.openFile(msg.FilePath)
	case dialog.ShowInitDialogMsg:
		if msg.Show && a.app.Session == nil {
			// Create the init dialog modal
			a.modal = dialog.NewInitDialogCmp()
			a.editor.Blur()
			cmd := a.modal.Init()
			cmds = append(cmds, cmd)
		}
	case dialog.CloseInitDialogMsg:
		if msg.Initialize {
			cmds = append(cmds, a.app.InitializeProject(context.Background()))
		}
		a.modal = nil
		updated, cmd := a.editor.Focus()
		a.editor = updated.(chat.EditorComponent)
		cmds = append(cmds, cmd)
	case chat.ConfirmationMsg:
		// Create a new confirmation message
		a.activeConfirmation = chat.NewConfirmationMessage(msg.ID, msg.Question)
		a.editor.Blur() // Remove focus from editor
	case chat.ConfirmationAnswerMsg:
		if msg.ID == "init-project" && msg.Answer {
			cmds = append(cmds, a.app.InitializeProject(context.Background()))
		}
		a.activeConfirmation = nil
		a.editor.Focus() // Return focus to editor
	case chat.ToolApprovalMsg:
		// Create a new tool approval message
		a.activeToolApproval = chat.NewToolApprovalMessage(msg.ID, msg.ToolName, msg.Description, msg.Metadata)
		a.editor.Blur() // Remove focus from editor
	case chat.ToolApprovalAnswerMsg:
		// Handle tool approval response - send to server
		if a.activeToolApproval != nil {
			// Send permission response to server
			go func() {
				ctx := context.Background()
				sessionID := a.app.Session.ID
				permissionID := msg.ID

				// Map approval to permission response
				var response string
				if msg.Approved {
					response = "once" // Could be "always" for future enhancement
				} else {
					response = "reject"
				}

				// Make HTTP request to permission endpoint
				url := fmt.Sprintf("/session/%s/permissions/%s", sessionID, permissionID)
				body := map[string]interface{}{
					"response": response,
				}

				var result bool
				err := a.app.Client.Post(ctx, url, body, &result)
				if err != nil {
					slog.Error("Failed to send permission response", "error", err, "sessionID", sessionID, "permissionID", permissionID)
				} else {
					slog.Info("Permission response sent", "sessionID", sessionID, "permissionID", permissionID, "response", response)
				}
			}()
		}

		// Clear the approval dialog and return focus
		a.activeToolApproval = nil
		a.editor.Focus() // Return focus to editor
	case chat.TextInputMsg:
		// Create a new text input message
		a.activeTextInput = chat.NewTextInputMessage(msg.ID, msg.Prompt, msg.Placeholder)
		a.editor.Blur() // Remove focus from editor
	case chat.TextInputAnswerMsg:
		// Handle text input response
		// TODO: Send input response to server
		a.activeTextInput = nil
		a.editor.Focus() // Return focus to editor

	// API
	case api.Request:
		slog.Info("api", "path", msg.Path)
		var response any = true
		switch msg.Path {
		case "/tui/open-help":
			// Skip modal creation during active chat to prevent overlay corruption
			if a.hasActiveChat() {
				slog.Warn("Attempted to create help modal during active chat")
				break
			}
			helpDialog := dialog.NewHelpDialog(a.app)
			a.modal = helpDialog
		case "/tui/append-prompt":
			var body struct {
				Text string `json:"text"`
			}
			json.Unmarshal((msg.Body), &body)
			existing := a.editor.Value()
			text := body.Text
			if existing != "" && !strings.HasSuffix(existing, " ") {
				text = " " + text
			}
			a.editor.SetValueWithAttachments(existing + text + " ")
		default:
			break
		}
		cmds = append(cmds, api.Reply(context.Background(), a.app.Client, response))
	}

	s, cmd := a.status.Update(msg)
	cmds = append(cmds, cmd)
	a.status = s.(status.StatusComponent)

	u, cmd := a.editor.Update(msg)
	a.editor = u.(chat.EditorComponent)
	cmds = append(cmds, cmd)

	u, cmd = a.messages.Update(msg)
	a.messages = u.(chat.MessagesComponent)
	cmds = append(cmds, cmd)

	if a.modal != nil {
		u, cmd := a.modal.Update(msg)
		a.modal = u.(layout.Modal)
		cmds = append(cmds, cmd)
	}

	if a.showCompletionDialog {
		u, cmd := a.completions.Update(msg)
		a.completions = u.(dialog.CompletionDialog)
		cmds = append(cmds, cmd)
	}

	fv, cmd := a.fileViewer.Update(msg)
	a.fileViewer = fv
	cmds = append(cmds, cmd)

	return a, tea.Batch(cmds...)
}

// hasActiveChat checks if the user is in an active chat session
func (a *Model) hasActiveChat() bool {
	// Check if we have an active session and any interactive elements
	return a.app != nil && a.app.Session.ID != "" &&
		(a.activeConfirmation != nil || a.activeToolApproval != nil ||
			a.activeTextInput != nil)
}

func (a Model) View() string {
	measure := util.Measure("app.View")
	defer measure()
	t := theme.CurrentTheme()

	var mainLayout string

	if a.app.Session.ID == "" {
		mainLayout = a.home()
	} else {
		mainLayout = a.chat()
	}
	mainLayout = styles.NewStyle().
		Background(t.Background()).
		Padding(0, 2).
		Render(mainLayout)
	mainLayout = lipgloss.PlaceHorizontal(
		a.width,
		lipgloss.Center,
		mainLayout,
		styles.WhitespaceStyle(t.Background()),
	)

	mainStyle := styles.NewStyle().Background(t.Background())
	mainLayout = mainStyle.Render(mainLayout)

	// Only render modal if not in active chat to prevent overlay corruption
	if a.modal != nil && !a.hasActiveChat() {
		mainLayout = a.modal.Render(mainLayout)
	}
	mainLayout = a.toastManager.RenderOverlay(mainLayout)

	if theme.CurrentThemeUsesAnsiColors() {
		mainLayout = util.ConvertRGBToAnsi16Colors(mainLayout)
	}
	return mainLayout + "\n" + a.status.View()
}

func (a Model) openFile(filepath string) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	response, err := a.app.Client.File.Read(
		context.Background(),
		opencode.FileReadParams{
			Path: opencode.F(filepath),
		},
	)
	if err != nil {
		slog.Error("Failed to read file", "error", err)
		return a, toast.NewErrorToast("Failed to read file")
	}
	a.fileViewer, cmd = a.fileViewer.SetFile(
		filepath,
		response.Content,
		response.Type == "patch",
	)
	return a, cmd
}

func (a Model) home() string {
	measure := util.Measure("home.View")
	defer measure()
	t := theme.CurrentTheme()
	effectiveWidth := a.width - 4
	baseStyle := styles.NewStyle().Background(t.Background())
	base := baseStyle.Render

	kuuzuki := `
██  ██ ██  ██ ██  ██ ██████ ██  ██ ██  ██ ██
████   ██░░██ ██░░██    ██  ██░░██ ████   ██
██ ██  ██░░██ ██░░██  ██    ██░░██ ██ ██  ██
██  ██  ████   ████  ██████  ████  ██  ██ ██`

	logo := base(kuuzuki)
	// cwd := app.Info.Path.Cwd
	// config := app.Info.Path.Config

	versionStyle := styles.NewStyle().
		Foreground(t.TextMuted()).
		Background(t.Background()).
		Width(lipgloss.Width(logo)).
		Align(lipgloss.Right)
	version := versionStyle.Render(a.app.Version)

	logoAndVersion := strings.Join([]string{logo, version}, "\n")
	logoAndVersion = lipgloss.PlaceHorizontal(
		effectiveWidth,
		lipgloss.Center,
		logoAndVersion,
		styles.WhitespaceStyle(t.Background()),
	)

	// Use limit of 4 for vscode, 6 for others
	limit := 6
	if util.IsVSCode() {
		limit = 4
	}

	// showVscode := util.IsVSCode()
	commandsView := cmdcomp.New(
		a.app,
		cmdcomp.WithBackground(t.Background()),
		cmdcomp.WithLimit(limit),
		// cmdcomp.WithVscode(showVscode),
	)
	cmds := lipgloss.PlaceHorizontal(
		effectiveWidth,
		lipgloss.Center,
		commandsView.View(),
		styles.WhitespaceStyle(t.Background()),
	)

	lines := []string{}
	lines = append(lines, "")
	lines = append(lines, "")
	lines = append(lines, logoAndVersion)
	lines = append(lines, "")
	lines = append(lines, "")
	lines = append(lines, cmds)
	lines = append(lines, "")
	lines = append(lines, "")

	mainHeight := lipgloss.Height(strings.Join(lines, "\n"))

	editorView := a.editor.View()
	editorWidth := lipgloss.Width(editorView)
	editorView = lipgloss.PlaceHorizontal(
		effectiveWidth,
		lipgloss.Center,
		editorView,
		styles.WhitespaceStyle(t.Background()),
	)
	lines = append(lines, editorView)

	editorLines := a.editor.Lines()

	mainLayout := lipgloss.Place(
		effectiveWidth,
		a.height,
		lipgloss.Center,
		lipgloss.Center,
		baseStyle.Render(strings.Join(lines, "\n")),
		styles.WhitespaceStyle(t.Background()),
	)

	editorX := (effectiveWidth - editorWidth) / 2
	editorY := (a.height / 2) + (mainHeight / 2) - 2

	if editorLines > 1 {
		mainLayout = layout.PlaceOverlay(
			editorX,
			editorY,
			a.editor.Content(),
			mainLayout,
		)
	}

	if a.showCompletionDialog {
		a.completions.SetWidth(editorWidth)
		overlay := a.completions.View()
		overlayHeight := lipgloss.Height(overlay)

		mainLayout = layout.PlaceOverlay(
			editorX,
			editorY-overlayHeight+1,
			overlay,
			mainLayout,
		)
	}

	// Add tool approval overlay if active (centered on screen)
	if a.activeToolApproval != nil {
		approvalOverlay := a.activeToolApproval.View(effectiveWidth)
		approvalWidth := lipgloss.Width(approvalOverlay)
		approvalHeight := lipgloss.Height(approvalOverlay)

		// Center the dialog on screen, lowered by 10%
		approvalX := (effectiveWidth - approvalWidth) / 2
		approvalY := (a.height-approvalHeight)/2 + int(float64(a.height)*0.1)

		// Ensure dialog stays within bounds
		if approvalX < 0 {
			approvalX = 0
		}
		if approvalY < 0 {
			approvalY = 0
		}

		mainLayout = layout.PlaceOverlay(
			approvalX,
			approvalY,
			approvalOverlay,
			mainLayout,
		)
	}

	return mainLayout
}

func (a Model) chat() string {
	measure := util.Measure("chat.View")
	defer measure()
	effectiveWidth := a.width - 4
	t := theme.CurrentTheme()
	editorView := a.editor.View()
	lines := a.editor.Lines()
	messagesView := a.messages.View()

	editorWidth := lipgloss.Width(editorView)
	editorHeight := max(lines, 5)
	editorView = lipgloss.PlaceHorizontal(
		effectiveWidth,
		lipgloss.Center,
		editorView,
		styles.WhitespaceStyle(t.Background()),
	)

	// Add interactive messages if active (except tool approval which will be overlaid)
	var interactiveView string
	if a.activeConfirmation != nil {
		interactiveView = a.activeConfirmation.View(effectiveWidth) + "\n"
	} else if a.activeTextInput != nil {
		interactiveView = a.activeTextInput.View(effectiveWidth) + "\n"
	}

	mainLayout := messagesView + "\n" + interactiveView + editorView
	editorX := (effectiveWidth - editorWidth) / 2

	if lines > 1 {
		editorY := a.height - editorHeight
		mainLayout = layout.PlaceOverlay(
			editorX,
			editorY,
			a.editor.Content(),
			mainLayout,
		)
	}

	if a.showCompletionDialog {
		a.completions.SetWidth(editorWidth)
		overlay := a.completions.View()
		overlayHeight := lipgloss.Height(overlay)
		editorY := a.height - editorHeight + 1

		mainLayout = layout.PlaceOverlay(
			editorX,
			editorY-overlayHeight,
			overlay,
			mainLayout,
		)
	}

	// Add tool approval overlay if active (centered on screen)
	if a.activeToolApproval != nil {
		approvalOverlay := a.activeToolApproval.View(effectiveWidth)
		approvalWidth := lipgloss.Width(approvalOverlay)
		approvalHeight := lipgloss.Height(approvalOverlay)

		// Center the dialog on screen, lowered by 10%
		approvalX := (effectiveWidth - approvalWidth) / 2
		approvalY := (a.height-approvalHeight)/2 + int(float64(a.height)*0.1)

		// Ensure dialog stays within bounds
		if approvalX < 0 {
			approvalX = 0
		}
		if approvalY < 0 {
			approvalY = 0
		}

		mainLayout = layout.PlaceOverlay(
			approvalX,
			approvalY,
			approvalOverlay,
			mainLayout,
		)
	}

	return mainLayout
}

func (a Model) executeCommand(command commands.Command) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	cmds := []tea.Cmd{
		util.CmdHandler(commands.CommandExecutedMsg(command)),
	}
	switch command.Name {
	case commands.AppHelpCommand:
		// Skip modal creation during active chat to prevent overlay corruption
		if a.hasActiveChat() {
			slog.Warn("Attempted to create help modal during active chat")
			return a, nil
		}
		helpDialog := dialog.NewHelpDialog(a.app)
		a.modal = helpDialog
	case commands.SwitchModeCommand:
		updated, cmd := a.app.SwitchMode()
		a.app = updated
		cmds = append(cmds, cmd)
	case commands.SwitchModeReverseCommand:
		updated, cmd := a.app.SwitchModeReverse()
		a.app = updated
		cmds = append(cmds, cmd)
	case commands.EditorOpenCommand:
		if a.app.IsBusy() {
			// status.Warn("Agent is working, please wait...")
			return a, nil
		}
		editor := os.Getenv("EDITOR")
		if editor == "" {
			return a, toast.NewErrorToast("No EDITOR set, can't open editor")
		}

		value := a.editor.Value()
		updated, cmd := a.editor.Clear()
		a.editor = updated.(chat.EditorComponent)
		cmds = append(cmds, cmd)

		tmpfile, err := os.CreateTemp("", "msg_*.md")
		tmpfile.WriteString(value)
		if err != nil {
			slog.Error("Failed to create temp file", "error", err)
			return a, toast.NewErrorToast("Something went wrong, couldn't open editor")
		}
		tmpfile.Close()
		parts := strings.Fields(editor)
		c := exec.Command(parts[0], append(parts[1:], tmpfile.Name())...) //nolint:gosec
		c.Stdin = os.Stdin
		c.Stdout = os.Stdout
		c.Stderr = os.Stderr
		cmd = tea.ExecProcess(c, func(err error) tea.Msg {
			if err != nil {
				slog.Error("Failed to open editor", "error", err)
				return nil
			}
			content, err := os.ReadFile(tmpfile.Name())
			if err != nil {
				slog.Error("Failed to read file", "error", err)
				return nil
			}
			if len(content) == 0 {
				slog.Warn("Message is empty")
				return nil
			}
			os.Remove(tmpfile.Name())
			return app.SetEditorContentMsg{
				Text: string(content),
			}
		})
		cmds = append(cmds, cmd)
	case commands.SessionNewCommand:
		if a.app.Session.ID == "" {
			return a, nil
		}
		a.app.Session = &opencode.Session{}
		a.app.Messages = []app.Message{}
		cmds = append(cmds, util.CmdHandler(app.SessionClearedMsg{}))
	case commands.SessionListCommand:
		// Skip modal creation during active chat to prevent overlay corruption
		if a.hasActiveChat() {
			slog.Warn("Attempted to create session list modal during active chat")
			return a, nil
		}
		sessionDialog := dialog.NewSessionDialog(a.app)
		a.modal = sessionDialog
	case commands.SessionShareCommand:
		if a.app.Session.ID == "" {
			return a, nil
		}
		response, err := a.app.Client.Session.Share(context.Background(), a.app.Session.ID)
		if err != nil {
			slog.Error("Failed to share session", "error", err)
			return a, toast.NewErrorToast("Failed to share session")
		}
		shareUrl := response.Share.URL
		cmds = append(cmds, app.SetClipboard(shareUrl))
		cmds = append(cmds, toast.NewSuccessToast("Share URL copied to clipboard!"))
	case commands.SessionUnshareCommand:
		if a.app.Session.ID == "" {
			return a, nil
		}
		_, err := a.app.Client.Session.Unshare(context.Background(), a.app.Session.ID)
		if err != nil {
			slog.Error("Failed to unshare session", "error", err)
			return a, toast.NewErrorToast("Failed to unshare session")
		}
		a.app.Session.Share.URL = ""
		cmds = append(cmds, toast.NewSuccessToast("Session unshared successfully"))
	case commands.SessionInterruptCommand:
		if a.app.Session.ID == "" {
			return a, nil
		}
		a.app.Cancel(context.Background(), a.app.Session.ID)
		return a, nil
	case commands.SessionCompactCommand:
		if a.app.Session.ID == "" {
			return a, nil
		}
		// TODO: block until compaction is complete
		a.app.CompactSession(context.Background())
	case commands.SessionExportCommand:
		if a.app.Session.ID == "" {
			return a, toast.NewErrorToast("No active session to export.")
		}

		// Use current conversation history
		messages := a.app.Messages
		if len(messages) == 0 {
			return a, toast.NewInfoToast("No messages to export.")
		}

		// Format to Markdown
		markdownContent := formatConversationToMarkdown(messages)

		// Check if EDITOR is set
		editor := os.Getenv("EDITOR")
		if editor == "" {
			return a, toast.NewErrorToast("No EDITOR set, can't open editor")
		}

		// Create and write to temp file
		tmpfile, err := os.CreateTemp("", "conversation-*.md")
		if err != nil {
			slog.Error("Failed to create temp file", "error", err)
			return a, toast.NewErrorToast("Failed to create temporary file.")
		}

		_, err = tmpfile.WriteString(markdownContent)
		if err != nil {
			slog.Error("Failed to write to temp file", "error", err)
			tmpfile.Close()
			os.Remove(tmpfile.Name())
			return a, toast.NewErrorToast("Failed to write conversation to file.")
		}
		tmpfile.Close()

		// Open in editor
		parts := strings.Fields(editor)
		c := exec.Command(parts[0], append(parts[1:], tmpfile.Name())...) //nolint:gosec
		c.Stdin = os.Stdin
		c.Stdout = os.Stdout
		c.Stderr = os.Stderr
		cmd = tea.ExecProcess(c, func(err error) tea.Msg {
			if err != nil {
				slog.Error("Failed to open editor for conversation", "error", err)
			}
			// Clean up the file after editor closes
			os.Remove(tmpfile.Name())
			return nil
		})
		cmds = append(cmds, cmd)
	case commands.ToolDetailsCommand:
		message := "Tool details are now visible"
		if a.messages.ToolDetailsVisible() {
			message = "Tool details are now hidden"
		}
		cmds = append(cmds, util.CmdHandler(chat.ToggleToolDetailsMsg{}))
		cmds = append(cmds, toast.NewInfoToast(message))
	case commands.ModelListCommand:
		// Skip modal creation during active chat to prevent overlay corruption
		if a.hasActiveChat() {
			slog.Warn("Attempted to create model list modal during active chat")
			return a, nil
		}
		modelDialog := dialog.NewModelDialog(a.app)
		a.modal = modelDialog
	case commands.ThemeListCommand:
		// Skip modal creation during active chat to prevent overlay corruption
		if a.hasActiveChat() {
			slog.Warn("Attempted to create theme list modal during active chat")
			return a, nil
		}
		themeDialog := dialog.NewThemeDialog()
		a.modal = themeDialog
	// case commands.FileListCommand:
	// 	a.editor.Blur()
	// 	findDialog := dialog.NewFindDialog(a.fileProvider)
	// 	cmds = append(cmds, findDialog.Init())
	// 	a.modal = findDialog
	case commands.FileCloseCommand:
		a.fileViewer, cmd = a.fileViewer.Clear()
		cmds = append(cmds, cmd)
	case commands.FileDiffToggleCommand:
		a.fileViewer, cmd = a.fileViewer.ToggleDiff()
		cmds = append(cmds, cmd)
		a.app.State.SplitDiff = a.fileViewer.DiffStyle() == fileviewer.DiffStyleSplit
		cmds = append(cmds, a.app.SaveState())
	case commands.FileSearchCommand:
		return a, nil
	case commands.ProjectInitCommand:
		cmds = append(cmds, a.app.InitializeProject(context.Background()))
	case commands.InputClearCommand:
		if a.editor.Value() == "" {
			return a, nil
		}
		updated, cmd := a.editor.Clear()
		a.editor = updated.(chat.EditorComponent)
		cmds = append(cmds, cmd)
	case commands.InputPasteCommand:
		updated, cmd := a.editor.Paste()
		a.editor = updated.(chat.EditorComponent)
		cmds = append(cmds, cmd)
	case commands.InputSubmitCommand:
		updated, cmd := a.editor.Submit()
		a.editor = updated.(chat.EditorComponent)
		cmds = append(cmds, cmd)
	case commands.InputNewlineCommand:
		updated, cmd := a.editor.Newline()
		a.editor = updated.(chat.EditorComponent)
		cmds = append(cmds, cmd)
	case commands.MessagesFirstCommand:
		updated, cmd := a.messages.GotoTop()
		a.messages = updated.(chat.MessagesComponent)
		cmds = append(cmds, cmd)
	case commands.MessagesLastCommand:
		updated, cmd := a.messages.GotoBottom()
		a.messages = updated.(chat.MessagesComponent)
		cmds = append(cmds, cmd)
	case commands.MessagesPageUpCommand:
		if a.fileViewer.HasFile() {
			a.fileViewer, cmd = a.fileViewer.PageUp()
			cmds = append(cmds, cmd)
		} else {
			updated, cmd := a.messages.PageUp()
			a.messages = updated.(chat.MessagesComponent)
			cmds = append(cmds, cmd)
		}
	case commands.MessagesPageDownCommand:
		if a.fileViewer.HasFile() {
			a.fileViewer, cmd = a.fileViewer.PageDown()
			cmds = append(cmds, cmd)
		} else {
			updated, cmd := a.messages.PageDown()
			a.messages = updated.(chat.MessagesComponent)
			cmds = append(cmds, cmd)
		}
	case commands.MessagesHalfPageUpCommand:
		if a.fileViewer.HasFile() {
			a.fileViewer, cmd = a.fileViewer.HalfPageUp()
			cmds = append(cmds, cmd)
		} else {
			updated, cmd := a.messages.HalfPageUp()
			a.messages = updated.(chat.MessagesComponent)
			cmds = append(cmds, cmd)
		}
	case commands.MessagesHalfPageDownCommand:
		if a.fileViewer.HasFile() {
			a.fileViewer, cmd = a.fileViewer.HalfPageDown()
			cmds = append(cmds, cmd)
		} else {
			updated, cmd := a.messages.HalfPageDown()
			a.messages = updated.(chat.MessagesComponent)
			cmds = append(cmds, cmd)
		}
	case commands.MessagesLayoutToggleCommand:
		a.messagesRight = !a.messagesRight
		a.app.State.MessagesRight = a.messagesRight
		cmds = append(cmds, a.app.SaveState())
	case commands.MessagesCopyCommand:
		updated, cmd := a.messages.CopyLastMessage()
		a.messages = updated.(chat.MessagesComponent)
		cmds = append(cmds, cmd)
	case commands.MessagesUndoCommand:
		updated, cmd := a.messages.UndoLastMessage()
		a.messages = updated.(chat.MessagesComponent)
		cmds = append(cmds, cmd)
	case commands.MessagesRedoCommand:
		updated, cmd := a.messages.RedoLastMessage()
		a.messages = updated.(chat.MessagesComponent)
		cmds = append(cmds, cmd)
	case commands.AppExitCommand:
		return a, tea.Quit
	}
	return a, tea.Batch(cmds...)
}

func NewModel(app *app.App) tea.Model {
	commandProvider := completions.NewCommandCompletionProvider(app)
	fileProvider := completions.NewFileContextGroup(app)
	symbolsProvider := completions.NewSymbolsContextGroup(app)

	messages := chat.NewMessagesComponent(app)
	editor := chat.NewEditorComponent(app)
	completions := dialog.NewCompletionDialogComponent("/", commandProvider)

	var leaderBinding *key.Binding
	if app.Config.Keybinds.Leader != "" {
		binding := key.NewBinding(key.WithKeys(app.Config.Keybinds.Leader))
		leaderBinding = &binding
	}

	model := &Model{
		status:               status.NewStatusCmp(app),
		app:                  app,
		editor:               editor,
		messages:             messages,
		completions:          completions,
		commandProvider:      commandProvider,
		fileProvider:         fileProvider,
		symbolsProvider:      symbolsProvider,
		leaderBinding:        leaderBinding,
		showCompletionDialog: false,
		toastManager:         toast.NewToastManager(),
		interruptKeyState:    InterruptKeyIdle,
		exitKeyState:         ExitKeyIdle,
		fileViewer:           fileviewer.New(app),
		messagesRight:        app.State.MessagesRight,
		// Initialize focus state - assume focused on startup
		hasFocus:       true,
		focusSupported: false, // Will be set to true when first focus event is received
	}

	// Set initial focus state in editor
	editor.SetFocusState(model.hasFocus, model.focusSupported)

	return model
}

func formatConversationToMarkdown(messages []app.Message) string {
	var builder strings.Builder

	builder.WriteString("# Conversation History\n\n")

	for _, msg := range messages {
		builder.WriteString("---\n\n")

		var role string
		var timestamp time.Time

		switch info := msg.Info.(type) {
		case opencode.UserMessage:
			role = "User"
			timestamp = time.UnixMilli(int64(info.Time.Created))
		case opencode.AssistantMessage:
			role = "Assistant"
			timestamp = time.UnixMilli(int64(info.Time.Created))
		default:
			continue
		}

		builder.WriteString(
			fmt.Sprintf("**%s** (*%s*)\n\n", role, timestamp.Format("2006-01-02 15:04:05")),
		)

		for _, part := range msg.Parts {
			switch p := part.(type) {
			case opencode.TextPart:
				builder.WriteString(p.Text + "\n\n")
			case opencode.FilePart:
				builder.WriteString(fmt.Sprintf("[File: %s]\n\n", p.Filename))
			case opencode.ToolPart:
				builder.WriteString(fmt.Sprintf("[Tool: %s]\n\n", p.Tool))
			}
		}
	}

	return builder.String()
}

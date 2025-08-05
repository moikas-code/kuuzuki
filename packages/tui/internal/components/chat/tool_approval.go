package chat

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/v2/key"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
)

// ToolApprovalMessage represents a tool approval request in the chat
type ToolApprovalMessage struct {
	ID          string
	ToolName    string
	Description string
	Metadata    map[string]interface{}
	Selected    int // 0 for approve, 1 for deny
	Answered    bool
	Approved    bool
}

// ToolApprovalMsg is sent when tool approval is needed
type ToolApprovalMsg struct {
	ID          string
	ToolName    string
	Description string
	Metadata    map[string]interface{}
}

// ToolApprovalAnswerMsg is sent when the user responds
type ToolApprovalAnswerMsg struct {
	ID       string
	Approved bool
	Response string // "once", "always", or "reject"
}

// NewToolApprovalMessage creates a new tool approval message
func NewToolApprovalMessage(id, toolName, description string, metadata map[string]interface{}) *ToolApprovalMessage {
	return &ToolApprovalMessage{
		ID:          id,
		ToolName:    toolName,
		Description: description,
		Metadata:    metadata,
		Selected:    0,
		Answered:    false,
	}
}

// Update handles input for the tool approval
func (t *ToolApprovalMessage) Update(msg tea.Msg) (*ToolApprovalMessage, tea.Cmd) {
	if t.Answered {
		return t, nil
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, key.NewBinding(key.WithKeys("left", "h"))):
			t.Selected = 0
		case key.Matches(msg, key.NewBinding(key.WithKeys("right", "l"))):
			t.Selected = 1
		case key.Matches(msg, key.NewBinding(key.WithKeys("tab"))):
			t.Selected = (t.Selected + 1) % 2
		// Upstream-compatible keyboard shortcuts
		case key.Matches(msg, key.NewBinding(key.WithKeys("enter"))):
			// Enter = Accept once (upstream behavior)
			t.Answered = true
			t.Approved = true
			return t, func() tea.Msg {
				return ToolApprovalAnswerMsg{ID: t.ID, Approved: true, Response: "once"}
			}
		case key.Matches(msg, key.NewBinding(key.WithKeys("a", "A"))):
			// A = Accept always (upstream behavior)
			t.Answered = true
			t.Approved = true
			return t, func() tea.Msg {
				return ToolApprovalAnswerMsg{ID: t.ID, Approved: true, Response: "always"}
			}
		case key.Matches(msg, key.NewBinding(key.WithKeys("esc"))):
			// Esc = Reject (upstream behavior)
			t.Answered = true
			t.Approved = false
			return t, func() tea.Msg {
				return ToolApprovalAnswerMsg{ID: t.ID, Approved: false, Response: "reject"}
			}
		// Legacy shortcuts for compatibility
		case key.Matches(msg, key.NewBinding(key.WithKeys("d"))):
			t.Answered = true
			t.Approved = false
			return t, func() tea.Msg {
				return ToolApprovalAnswerMsg{ID: t.ID, Approved: false, Response: "reject"}
			}
		}
	}
	return t, nil
}

// View renders the tool approval message
func (t *ToolApprovalMessage) View(width int) string {
	theme := theme.CurrentTheme()
	baseStyle := styles.NewStyle().Foreground(theme.Text())

	// Title with kuuzuki branding
	titleStyle := baseStyle.
		Foreground(theme.Warning()).
		Bold(true).
		Padding(1, 2, 0, 2)
	title := titleStyle.Render("🔒 kuuzuki Permission Required")

	// Tool info with icon
	toolIcon := "🔧"
	switch t.ToolName {
	case "bash":
		toolIcon = "⚡"
	case "edit":
		toolIcon = "✏️"
	case "write":
		toolIcon = "📝"
	case "read":
		toolIcon = "📖"
	}

	toolStyle := baseStyle.
		Foreground(theme.Primary()).
		Padding(0, 2)
	toolInfo := toolStyle.Render(fmt.Sprintf("%s Tool: %s", toolIcon, t.ToolName))

	// Description with danger detection
	descColor := theme.TextMuted()
	isDangerous := false
	if cmd, ok := t.Metadata["command"].(string); ok && t.ToolName == "bash" {
		if strings.Contains(cmd, "rm ") || strings.Contains(cmd, "delete") || strings.Contains(cmd, "DROP") {
			isDangerous = true
			descColor = theme.Warning()
		}
	}

	descStyle := baseStyle.
		Foreground(descColor).
		Padding(0, 2)

	description := t.Description
	if isDangerous {
		description = "⚠️  " + description
	}
	desc := descStyle.Render(description)

	if t.Answered {
		// Show the answer
		answerText := "Denied"
		answerColor := theme.Error()
		if t.Approved {
			answerText = "Approved"
			answerColor = theme.Success()
		}
		answerStyle := baseStyle.
			Foreground(answerColor).
			Padding(0, 2, 1, 2)
		answer := answerStyle.Render(fmt.Sprintf("✓ %s", answerText))
		return lipgloss.JoinVertical(lipgloss.Left, title, toolInfo, desc, answer)
	}

	// Approve/Deny buttons
	approveStyle := baseStyle
	denyStyle := baseStyle

	if t.Selected == 0 {
		approveStyle = approveStyle.
			Background(theme.Success()).
			Foreground(theme.Background()).
			Bold(true)
		denyStyle = denyStyle.
			Foreground(theme.Error())
	} else {
		denyStyle = denyStyle.
			Background(theme.Error()).
			Foreground(theme.Background()).
			Bold(true)
		approveStyle = approveStyle.
			Foreground(theme.Success())
	}

	approve := approveStyle.Padding(0, 3).Render("Approve")
	deny := denyStyle.Padding(0, 3).Render("Deny")

	buttons := lipgloss.JoinHorizontal(lipgloss.Left, approve, baseStyle.Render("  "), deny)
	buttonsContainer := baseStyle.Padding(1, 2, 0, 2).Render(buttons)

	// Help text with upstream-compatible shortcuts
	helpStyle := baseStyle.Foreground(theme.TextMuted()).Italic(true)
	help := helpStyle.Padding(0, 2, 1, 2).Render("⚡ [Enter] Accept Once    🔄 [A] Always Allow    ❌ [Esc] Reject")

	// Combine all parts
	content := lipgloss.JoinVertical(
		lipgloss.Left,
		title,
		toolInfo,
		desc,
		buttonsContainer,
		help,
	)

	// Add a border around the whole thing with kuuzuki accent colors
	borderColor := theme.Accent() // Use kuuzuki accent color
	if isDangerous {
		borderColor = theme.Warning() // Use warning color for dangerous operations
	}

	borderStyle := baseStyle.
		Border(lipgloss.ThickBorder()).
		BorderForeground(borderColor).
		Background(theme.BackgroundPanel()). // Use panel background for better contrast
		Width(width-4).
		Margin(1, 2).
		Padding(1)

	return borderStyle.Render(content)
}

package chat

import (
	"fmt"

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
		case key.Matches(msg, key.NewBinding(key.WithKeys("a"))):
			t.Answered = true
			t.Approved = true
			return t, func() tea.Msg {
				return ToolApprovalAnswerMsg{ID: t.ID, Approved: true}
			}
		case key.Matches(msg, key.NewBinding(key.WithKeys("d"))):
			t.Answered = true
			t.Approved = false
			return t, func() tea.Msg {
				return ToolApprovalAnswerMsg{ID: t.ID, Approved: false}
			}
		case key.Matches(msg, key.NewBinding(key.WithKeys("enter"))):
			t.Answered = true
			t.Approved = t.Selected == 0
			return t, func() tea.Msg {
				return ToolApprovalAnswerMsg{ID: t.ID, Approved: t.Approved}
			}
		}
	}
	return t, nil
}

// View renders the tool approval message
func (t *ToolApprovalMessage) View(width int) string {
	theme := theme.CurrentTheme()
	baseStyle := styles.NewStyle().Foreground(theme.Text())

	// Title
	titleStyle := baseStyle.
		Foreground(theme.Warning()).
		Bold(true).
		Padding(1, 2, 0, 2)
	title := titleStyle.Render("🔧 Tool Approval Required")

	// Tool info
	toolStyle := baseStyle.
		Foreground(theme.Primary()).
		Padding(0, 2)
	toolInfo := toolStyle.Render(fmt.Sprintf("Tool: %s", t.ToolName))

	// Description
	descStyle := baseStyle.
		Foreground(theme.TextMuted()).
		Padding(0, 2)
	desc := descStyle.Render(t.Description)

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

	// Help text
	helpStyle := baseStyle.Foreground(theme.TextMuted()).Italic(true)
	help := helpStyle.Padding(0, 2, 1, 2).Render("Use ←/→ or Tab to select, Enter to confirm, or press A/D")

	// Combine all parts
	content := lipgloss.JoinVertical(
		lipgloss.Left,
		title,
		toolInfo,
		desc,
		buttonsContainer,
		help,
	)

	// Add a border around the whole thing with enhanced visibility for overlay
	borderStyle := baseStyle.
		Border(lipgloss.ThickBorder()).
		BorderForeground(theme.Warning()).
		Background(theme.Background()).
		Width(width-4).
		Margin(1, 2).
		Padding(1)

	return borderStyle.Render(content)
}

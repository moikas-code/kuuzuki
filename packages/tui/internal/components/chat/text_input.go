package chat

import (
	"fmt"

	"github.com/charmbracelet/bubbles/v2/key"
	"github.com/charmbracelet/bubbles/v2/textinput"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
)

// TextInputMessage represents a text input request in the chat
type TextInputMessage struct {
	ID          string
	Prompt      string
	Placeholder string
	Value       string
	Submitted   bool
	input       textinput.Model
}

// TextInputMsg is sent when text input is needed
type TextInputMsg struct {
	ID          string
	Prompt      string
	Placeholder string
}

// TextInputAnswerMsg is sent when the user submits input
type TextInputAnswerMsg struct {
	ID    string
	Value string
}

// NewTextInputMessage creates a new text input message
func NewTextInputMessage(id, prompt, placeholder string) *TextInputMessage {
	ti := textinput.New()
	ti.Placeholder = placeholder
	ti.Focus()
	ti.CharLimit = 500

	return &TextInputMessage{
		ID:          id,
		Prompt:      prompt,
		Placeholder: placeholder,
		input:       ti,
		Submitted:   false,
	}
}

// Update handles input for the text input
func (t *TextInputMessage) Update(msg tea.Msg) (*TextInputMessage, tea.Cmd) {
	if t.Submitted {
		return t, nil
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, key.NewBinding(key.WithKeys("enter"))):
			t.Value = t.input.Value()
			t.Submitted = true
			return t, func() tea.Msg {
				return TextInputAnswerMsg{ID: t.ID, Value: t.Value}
			}
		case key.Matches(msg, key.NewBinding(key.WithKeys("esc"))):
			t.Value = ""
			t.Submitted = true
			return t, func() tea.Msg {
				return TextInputAnswerMsg{ID: t.ID, Value: ""}
			}
		}
	}

	var cmd tea.Cmd
	t.input, cmd = t.input.Update(msg)
	return t, cmd
}

// View renders the text input message
func (t *TextInputMessage) View(width int) string {
	theme := theme.CurrentTheme()
	baseStyle := styles.NewStyle().Foreground(theme.Text())

	// Prompt
	promptStyle := baseStyle.
		Foreground(theme.Primary()).
		Bold(true).
		Padding(1, 2, 0, 2)
	prompt := promptStyle.Render(t.Prompt)

	if t.Submitted {
		// Show the submitted value
		valueText := t.Value
		if valueText == "" {
			valueText = "(cancelled)"
		}
		valueStyle := baseStyle.
			Foreground(theme.TextMuted()).
			Padding(0, 2, 1, 2)
		value := valueStyle.Render(fmt.Sprintf("Answer: %s", valueText))
		return lipgloss.JoinVertical(lipgloss.Left, prompt, value)
	}

	// Input field
	inputContainer := baseStyle.Padding(0, 2).Render(t.input.View())

	// Help text
	helpStyle := baseStyle.Foreground(theme.TextMuted()).Italic(true)
	help := helpStyle.Padding(0, 2, 1, 2).Render("Enter to submit, Esc to cancel")

	// Combine all parts
	content := lipgloss.JoinVertical(
		lipgloss.Left,
		prompt,
		inputContainer,
		help,
	)

	// Add a border around the whole thing
	borderStyle := baseStyle.
		Border(lipgloss.RoundedBorder()).
		BorderForeground(theme.Primary()).
		Width(width - 4).
		Margin(1, 2)

	return borderStyle.Render(content)
}

// Focus sets focus on the text input
func (t *TextInputMessage) Focus() tea.Cmd {
	return t.input.Focus()
}

// Blur removes focus from the text input
func (t *TextInputMessage) Blur() {
	t.input.Blur()
}
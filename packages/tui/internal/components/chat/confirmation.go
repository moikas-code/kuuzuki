package chat

import (
	"fmt"

	"github.com/charmbracelet/bubbles/v2/key"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
)

// ConfirmationMessage represents a yes/no question in the chat
type ConfirmationMessage struct {
	ID       string
	Question string
	Selected int // 0 for yes, 1 for no
	Answered bool
	Answer   bool
}

// ConfirmationMsg is sent when a confirmation is needed
type ConfirmationMsg struct {
	ID       string
	Question string
}

// ConfirmationAnswerMsg is sent when the user answers
type ConfirmationAnswerMsg struct {
	ID     string
	Answer bool
}

// NewConfirmationMessage creates a new confirmation message
func NewConfirmationMessage(id, question string) *ConfirmationMessage {
	return &ConfirmationMessage{
		ID:       id,
		Question: question,
		Selected: 0,
		Answered: false,
	}
}

// Update handles input for the confirmation
func (c *ConfirmationMessage) Update(msg tea.Msg) (*ConfirmationMessage, tea.Cmd) {
	if c.Answered {
		return c, nil
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, key.NewBinding(key.WithKeys("left", "h"))):
			c.Selected = 0
		case key.Matches(msg, key.NewBinding(key.WithKeys("right", "l"))):
			c.Selected = 1
		case key.Matches(msg, key.NewBinding(key.WithKeys("tab"))):
			c.Selected = (c.Selected + 1) % 2
		case key.Matches(msg, key.NewBinding(key.WithKeys("y"))):
			c.Answered = true
			c.Answer = true
			return c, func() tea.Msg {
				return ConfirmationAnswerMsg{ID: c.ID, Answer: true}
			}
		case key.Matches(msg, key.NewBinding(key.WithKeys("n"))):
			c.Answered = true
			c.Answer = false
			return c, func() tea.Msg {
				return ConfirmationAnswerMsg{ID: c.ID, Answer: false}
			}
		case key.Matches(msg, key.NewBinding(key.WithKeys("enter"))):
			c.Answered = true
			c.Answer = c.Selected == 0
			return c, func() tea.Msg {
				return ConfirmationAnswerMsg{ID: c.ID, Answer: c.Answer}
			}
		}
	}
	return c, nil
}

// View renders the confirmation message
func (c *ConfirmationMessage) View(width int) string {
	t := theme.CurrentTheme()
	baseStyle := styles.NewStyle().Foreground(t.Text())

	// Question
	questionStyle := baseStyle.
		Foreground(t.Primary()).
		Bold(true).
		Padding(1, 2)
	question := questionStyle.Render(c.Question)

	if c.Answered {
		// Show the answer
		answerText := "No"
		if c.Answer {
			answerText = "Yes"
		}
		answerStyle := baseStyle.
			Foreground(t.TextMuted()).
			Padding(0, 2, 1, 2)
		answer := answerStyle.Render(fmt.Sprintf("Answer: %s", answerText))
		return lipgloss.JoinVertical(lipgloss.Left, question, answer)
	}

	// Yes/No buttons
	yesStyle := baseStyle
	noStyle := baseStyle

	if c.Selected == 0 {
		yesStyle = yesStyle.
			Background(t.Primary()).
			Foreground(t.Background()).
			Bold(true)
		noStyle = noStyle.
			Foreground(t.Primary())
	} else {
		noStyle = noStyle.
			Background(t.Primary()).
			Foreground(t.Background()).
			Bold(true)
		yesStyle = yesStyle.
			Foreground(t.Primary())
	}

	yes := yesStyle.Padding(0, 3).Render("Yes")
	no := noStyle.Padding(0, 3).Render("No")

	buttons := lipgloss.JoinHorizontal(lipgloss.Left, yes, baseStyle.Render("  "), no)
	buttonsContainer := baseStyle.Padding(0, 2, 1, 2).Render(buttons)

	// Help text
	helpStyle := baseStyle.Foreground(t.TextMuted()).Italic(true)
	help := helpStyle.Padding(0, 2).Render("Use ←/→ or Tab to select, Enter to confirm, or press Y/N")

	// Combine all parts
	content := lipgloss.JoinVertical(
		lipgloss.Left,
		question,
		buttonsContainer,
		help,
	)

	// Add a border around the whole thing
	borderStyle := baseStyle.
		Border(lipgloss.RoundedBorder()).
		BorderForeground(t.BorderActive()).
		Width(width - 4).
		Margin(1, 2)

	return borderStyle.Render(content)
}
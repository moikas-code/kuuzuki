package dialog

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/muesli/reflow/truncate"
	opencode "github.com/sst/opencode-sdk-go"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/components/list"
	"github.com/sst/opencode/internal/components/modal"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
)

// AgentsDialog interface for the agent switching dialog
type AgentsDialog interface {
	layout.Modal
}

// agentItem is a custom list item for agents
type agentItem struct {
	agent          opencode.Agent
	isCurrentAgent bool
}

func (a agentItem) Render(
	selected bool,
	width int,
	isFirstInViewport bool,
	baseStyle styles.Style,
) string {
	t := theme.CurrentTheme()

	var text string
	var statusIcon string

	if a.isCurrentAgent {
		statusIcon = "🟢 " // Green circle for active agent
		text = statusIcon + a.agent.Name
	} else {
		statusIcon = "⚪ " // White circle for inactive agent
		text = statusIcon + a.agent.Name
	}

	// Add description if available with better formatting
	if a.agent.Description != "" {
		text += "\n  " + a.agent.Description
	}

	truncatedStr := truncate.StringWithTail(text, uint(width-1), "...")

	var itemStyle styles.Style
	if selected {
		if a.isCurrentAgent {
			// Enhanced style for current agent when selected
			itemStyle = baseStyle.
				Background(t.Primary()).
				Foreground(t.BackgroundElement()).
				Width(width).
				PaddingLeft(1).
				Bold(true).
				Border(lipgloss.RoundedBorder()).
				BorderForeground(t.Accent())
		} else {
			// Normal selection with subtle border
			itemStyle = baseStyle.
				Background(t.Primary()).
				Foreground(t.BackgroundElement()).
				Width(width).
				PaddingLeft(1).
				Border(lipgloss.RoundedBorder()).
				BorderForeground(t.Primary())
		}
	} else {
		if a.isCurrentAgent {
			// Enhanced highlight for current agent when not selected
			itemStyle = baseStyle.
				Foreground(t.Primary()).
				PaddingLeft(1).
				Bold(true).
				Border(lipgloss.RoundedBorder()).
				BorderForeground(t.Accent())
		} else {
			itemStyle = baseStyle.
				Foreground(t.Text()).
				PaddingLeft(1)
		}
	}

	return itemStyle.Render(truncatedStr)
}

func (a agentItem) Selectable() bool {
	return true
}

type agentsDialog struct {
	width  int
	height int
	modal  *modal.Modal
	agents []opencode.Agent
	list   list.List[agentItem]
	app    *app.App
}

func (a *agentsDialog) Init() tea.Cmd {
	return nil
}

func (a *agentsDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		a.width = msg.Width
		a.height = msg.Height
		a.list.SetMaxWidth(layout.Current.Container.Width - 12)
	case tea.KeyPressMsg:
		switch msg.String() {
		case "enter":
			if _, idx := a.list.GetSelectedItem(); idx >= 0 && idx < len(a.agents) {
				// Update the app's agent directly
				a.app.AgentIndex = idx
				a.app.Agent = &a.agents[idx]

				// Update state
				a.app.State.Mode = a.app.Agent.Name

				return a, tea.Sequence(
					util.CmdHandler(modal.CloseModalMsg{}),
					a.app.SaveState(),
				)
			}
		}
	}

	var cmd tea.Cmd
	listModel, cmd := a.list.Update(msg)
	a.list = listModel.(list.List[agentItem])
	return a, cmd
}

func (a *agentsDialog) Render(background string) string {
	listView := a.list.View()

	t := theme.CurrentTheme()
	keyStyle := styles.NewStyle().Foreground(t.Text()).Background(t.BackgroundPanel()).Render
	mutedStyle := styles.NewStyle().Foreground(t.TextMuted()).Background(t.BackgroundPanel()).Render

	helpText := keyStyle("enter") + mutedStyle(" select agent")

	bgColor := t.BackgroundPanel()
	helpSection := layout.Render(layout.FlexOptions{
		Direction:  layout.Row,
		Justify:    layout.JustifyCenter,
		Width:      layout.Current.Container.Width - 14,
		Background: &bgColor,
	}, layout.FlexItem{View: helpText})

	helpSection = styles.NewStyle().PaddingLeft(1).PaddingTop(1).Render(helpSection)

	content := strings.Join([]string{listView, helpSection}, "\n")

	return a.modal.Render(content, background)
}

func (a *agentsDialog) Close() tea.Cmd {
	return nil
}

// NewAgentsDialog creates a new agent switching dialog
func NewAgentsDialog(app *app.App) AgentsDialog {
	agents := app.Agents

	var items []agentItem
	for _, agent := range agents {
		items = append(items, agentItem{
			agent:          agent,
			isCurrentAgent: app.Agent != nil && app.Agent.Name == agent.Name,
		})
	}

	listComponent := list.NewListComponent(
		list.WithItems(items),
		list.WithMaxVisibleHeight[agentItem](10),
		list.WithFallbackMessage[agentItem]("No agents available"),
		list.WithAlphaNumericKeys[agentItem](true),
		list.WithRenderFunc(
			func(item agentItem, selected bool, width int, baseStyle styles.Style) string {
				return item.Render(selected, width, false, baseStyle)
			},
		),
		list.WithSelectableFunc(func(item agentItem) bool {
			return true
		}),
	)
	listComponent.SetMaxWidth(layout.Current.Container.Width - 12)

	return &agentsDialog{
		agents: agents,
		list:   listComponent,
		app:    app,
		modal: modal.New(
			modal.WithTitle("Switch Agent"),
			modal.WithMaxWidth(layout.Current.Container.Width-8),
		),
	}
}

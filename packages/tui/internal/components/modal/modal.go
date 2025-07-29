package modal

import (
	"strings"

	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
)

// CloseModalMsg is a message to signal that the active modal should be closed.
type CloseModalMsg struct{}

// Modal is a reusable modal component that handles frame rendering and overlay placement
type Modal struct {
	width      int
	height     int
	title      string
	maxWidth   int
	maxHeight  int
	fitContent bool
}

// ModalOption is a function that configures a Modal
type ModalOption func(*Modal)

// WithTitle sets the modal title
func WithTitle(title string) ModalOption {
	return func(m *Modal) {
		m.title = title
	}
}

// WithMaxWidth sets the maximum width
func WithMaxWidth(width int) ModalOption {
	return func(m *Modal) {
		m.maxWidth = width
		m.fitContent = false
	}
}

// WithMaxHeight sets the maximum height
func WithMaxHeight(height int) ModalOption {
	return func(m *Modal) {
		m.maxHeight = height
	}
}

func WithFitContent(fit bool) ModalOption {
	return func(m *Modal) {
		m.fitContent = fit
	}
}

// New creates a new Modal with the given options
func New(opts ...ModalOption) *Modal {
	m := &Modal{
		maxWidth:   0,
		maxHeight:  0,
		fitContent: true,
	}

	for _, opt := range opts {
		opt(m)
	}

	return m
}

func (m *Modal) SetTitle(title string) {
	m.title = title
}

// Render renders the modal centered on the screen
func (m *Modal) Render(contentView string, background string) string {
	t := theme.CurrentTheme()

	// Get background dimensions
	bgHeight := lipgloss.Height(background)
	bgWidth := lipgloss.Width(background)

	// Calculate content dimensions
	contentWidth := lipgloss.Width(contentView)

	// Determine modal width
	outerWidth := contentWidth + 8 // Add padding for borders and spacing
	if m.maxWidth > 0 && outerWidth > m.maxWidth {
		outerWidth = m.maxWidth
	}
	// Ensure it fits in the terminal
	if outerWidth > bgWidth - 4 {
		outerWidth = bgWidth - 4
	}

	innerWidth := outerWidth - 4

	baseStyle := styles.NewStyle().
		Foreground(t.TextMuted()).
		Background(t.BackgroundPanel())

	var finalContent string
	if m.title != "" {
		titleStyle := baseStyle.
			Foreground(t.Text()).
			Bold(true).
			Padding(0, 1)

		escStyle := baseStyle.Foreground(t.TextMuted())
		escText := escStyle.Render("esc")

		// Calculate position for esc text
		titleWidth := lipgloss.Width(m.title)
		escWidth := lipgloss.Width(escText)
		spacesNeeded := max(0, innerWidth-titleWidth-escWidth-2)
		spacer := strings.Repeat(" ", spacesNeeded)
		titleLine := m.title + spacer + escText
		titleLine = titleStyle.Render(titleLine)

		finalContent = strings.Join([]string{titleLine, "", contentView}, "\n")
	} else {
		finalContent = contentView
	}

	// Create modal with border
	modalStyle := baseStyle.
		Border(lipgloss.RoundedBorder()).
		BorderForeground(t.BorderActive()).
		PaddingTop(1).
		PaddingBottom(1).
		PaddingLeft(2).
		PaddingRight(2).
		Width(innerWidth)

	modalView := modalStyle.Render(finalContent)

	// Calculate modal dimensions after rendering
	modalHeight := lipgloss.Height(modalView)
	modalWidth := lipgloss.Width(modalView)

	// Calculate centered position
	row := (bgHeight - modalHeight) / 2
	col := (bgWidth - modalWidth) / 2

	// Ensure we don't go negative
	row = max(0, row)
	col = max(0, col)

	// Create a simple centered overlay by using lipgloss positioning
	// This avoids potential issues with PlaceOverlay
	centered := lipgloss.Place(
		bgWidth,
		bgHeight,
		lipgloss.Center,
		lipgloss.Center,
		modalView,
	)
	
	return centered
}

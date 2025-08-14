package attachment

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type TextSource struct {
	Value string `toml:"value"`
}

type FileSource struct {
	Path string `toml:"path"`
	Mime string `toml:"mime"`
	Data []byte `toml:"data,omitempty"` // Optional for image data
}

type SymbolSource struct {
	Path  string      `toml:"path"`
	Name  string      `toml:"name"`
	Kind  int         `toml:"kind"`
	Range SymbolRange `toml:"range"`
}

type SymbolRange struct {
	Start Position `toml:"start"`
	End   Position `toml:"end"`
}

type Position struct {
	Line int `toml:"line"`
	Char int `toml:"char"`
}

type Attachment struct {
	ID         string `toml:"id"`
	Type       string `toml:"type"`
	Display    string `toml:"display"`
	URL        string `toml:"url"`
	Filename   string `toml:"filename"`
	MediaType  string `toml:"media_type"`
	StartIndex int    `toml:"start_index"`
	EndIndex   int    `toml:"end_index"`
	Source     any    `toml:"source,omitempty"`
}

// NewAttachment creates a new attachment with a unique ID
func NewAttachment() *Attachment {
	return &Attachment{
		ID: uuid.NewString(),
	}
}

func (a *Attachment) GetTextSource() (*TextSource, bool) {
	if a.Type != "text" {
		return nil, false
	}
	ts, ok := a.Source.(*TextSource)
	return ts, ok
}

// GetFileSource returns the source as FileSource if the attachment is a file type
func (a *Attachment) GetFileSource() (*FileSource, bool) {
	if a.Type != "file" {
		return nil, false
	}
	fs, ok := a.Source.(*FileSource)
	return fs, ok
}

// GetSymbolSource returns the source as SymbolSource if the attachment is a symbol type
func (a *Attachment) GetSymbolSource() (*SymbolSource, bool) {
	if a.Type != "symbol" {
		return nil, false
	}
	ss, ok := a.Source.(*SymbolSource)
	return ss, ok
}

// GetFileIcon returns an appropriate icon for the file type
func (a *Attachment) GetFileIcon() string {
	if a.Type != "file" {
		return "📄"
	}

	// Get file extension
	ext := ""
	if fs, ok := a.GetFileSource(); ok && fs.Path != "" {
		parts := strings.Split(fs.Path, ".")
		if len(parts) > 1 {
			ext = strings.ToLower(parts[len(parts)-1])
		}
	}

	// Return appropriate icon based on file type
	switch ext {
	case "go":
		return "🐹"
	case "js", "ts", "jsx", "tsx":
		return "📜"
	case "py":
		return "🐍"
	case "rs":
		return "🦀"
	case "java":
		return "☕"
	case "cpp", "c", "cc", "cxx":
		return "⚙️"
	case "html", "htm":
		return "🌐"
	case "css", "scss", "sass":
		return "🎨"
	case "json":
		return "📋"
	case "md", "markdown":
		return "📝"
	case "txt":
		return "📄"
	case "pdf":
		return "📕"
	case "png", "jpg", "jpeg", "gif", "svg":
		return "🖼️"
	case "zip", "tar", "gz", "rar":
		return "📦"
	default:
		return "📄"
	}
}

// GetFormattedSize returns human-readable file size
func (a *Attachment) GetFormattedSize() string {
	if fs, ok := a.GetFileSource(); ok && len(fs.Data) > 0 {
		return formatBytes(int64(len(fs.Data)))
	}
	return ""
}

// formatBytes formats byte count into human readable format
func formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

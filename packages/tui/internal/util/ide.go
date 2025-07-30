package util

import (
	"os"
	"strings"
)

var SUPPORTED_IDES = []struct {
	Search    string
	ShortName string
}{
	{"Windsurf", "Windsurf"},
	{"Visual Studio Code", "VS Code"},
	{"Cursor", "Cursor"},
	{"VSCodium", "VSCodium"},
}

func IsVSCode() bool {
	return os.Getenv("KUUZUKI_CALLER") == "vscode"
}

func Ide() string {
	for _, ide := range SUPPORTED_IDES {
		if strings.Contains(os.Getenv("GIT_ASKPASS"), ide.Search) {
			return ide.ShortName
		}
	}

	return "unknown"
}

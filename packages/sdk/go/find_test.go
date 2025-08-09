// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package kuuzuki_test

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/sst/opencode-sdk-go"
	"github.com/sst/opencode-sdk-go/internal/testutil"
	"github.com/sst/opencode-sdk-go/option"
)

func TestFindFiles(t *testing.T) {
	t.Skip("skipped: tests are disabled for the time being")
	baseURL := "http://localhost:4010"
	if envURL, ok := os.LookupEnv("TEST_API_BASE_URL"); ok {
		baseURL = envURL
	}
	if !testutil.CheckTestServer(t, baseURL) {
		return
	}
	client := kuuzuki.NewClient(
		option.WithBaseURL(baseURL),
	)
	_, err := client.Find.Files(context.TODO(), kuuzuki.FindFilesParams{
		Query: kuuzuki.F("query"),
	})
	if err != nil {
		var apierr *kuuzuki.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

func TestFindSymbols(t *testing.T) {
	t.Skip("skipped: tests are disabled for the time being")
	baseURL := "http://localhost:4010"
	if envURL, ok := os.LookupEnv("TEST_API_BASE_URL"); ok {
		baseURL = envURL
	}
	if !testutil.CheckTestServer(t, baseURL) {
		return
	}
	client := kuuzuki.NewClient(
		option.WithBaseURL(baseURL),
	)
	_, err := client.Find.Symbols(context.TODO(), kuuzuki.FindSymbolsParams{
		Query: kuuzuki.F("query"),
	})
	if err != nil {
		var apierr *kuuzuki.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

func TestFindText(t *testing.T) {
	t.Skip("skipped: tests are disabled for the time being")
	baseURL := "http://localhost:4010"
	if envURL, ok := os.LookupEnv("TEST_API_BASE_URL"); ok {
		baseURL = envURL
	}
	if !testutil.CheckTestServer(t, baseURL) {
		return
	}
	client := kuuzuki.NewClient(
		option.WithBaseURL(baseURL),
	)
	_, err := client.Find.Text(context.TODO(), kuuzuki.FindTextParams{
		Pattern: kuuzuki.F("pattern"),
	})
	if err != nil {
		var apierr *kuuzuki.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

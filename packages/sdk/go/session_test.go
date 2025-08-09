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

func TestSessionNew(t *testing.T) {
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
	_, err := client.Session.New(context.TODO())
	if err != nil {
		var apierr *kuuzuki.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

func TestSessionList(t *testing.T) {
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
	_, err := client.Session.List(context.TODO())
	if err != nil {
		var apierr *kuuzuki.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

func TestSessionDelete(t *testing.T) {
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
	_, err := client.Session.Delete(context.TODO(), "id")
	if err != nil {
		var apierr *kuuzuki.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

func TestSessionAbort(t *testing.T) {
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
	_, err := client.Session.Abort(context.TODO(), "id")
	if err != nil {
		var apierr *kuuzuki.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

func TestSessionChatWithOptionalParams(t *testing.T) {
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
	_, err := client.Session.Chat(
		context.TODO(),
		"id",
		kuuzuki.SessionChatParams{
			ModelID: kuuzuki.F("modelID"),
			Parts: kuuzuki.F([]kuuzuki.SessionChatParamsPartUnion{kuuzuki.TextPartInputParam{
				Text:      kuuzuki.F("text"),
				Type:      kuuzuki.F(kuuzuki.TextPartInputTypeText),
				ID:        kuuzuki.F("id"),
				Synthetic: kuuzuki.F(true),
				Time: kuuzuki.F(kuuzuki.TextPartInputTimeParam{
					Start: kuuzuki.F(0.000000),
					End:   kuuzuki.F(0.000000),
				}),
			}}),
			ProviderID: kuuzuki.F("providerID"),
			Agent:      kuuzuki.F("agent"),
			MessageID:  kuuzuki.F("msg"),
			System:     kuuzuki.F("system"),
			Tools: kuuzuki.F(map[string]bool{
				"foo": true,
			}),
		},
	)
	if err != nil {
		var apierr *kuuzuki.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

func TestSessionInit(t *testing.T) {
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
	_, err := client.Session.Init(
		context.TODO(),
		"id",
		kuuzuki.SessionInitParams{
			MessageID:  kuuzuki.F("messageID"),
			ModelID:    kuuzuki.F("modelID"),
			ProviderID: kuuzuki.F("providerID"),
		},
	)
	if err != nil {
		var apierr *kuuzuki.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

func TestSessionMessage(t *testing.T) {
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
	_, err := client.Session.Message(
		context.TODO(),
		"id",
		"messageID",
	)
	if err != nil {
		var apierr *kuuzuki.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

func TestSessionMessages(t *testing.T) {
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
	_, err := client.Session.Messages(context.TODO(), "id")
	if err != nil {
		var apierr *kuuzuki.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

func TestSessionRevertWithOptionalParams(t *testing.T) {
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
	_, err := client.Session.Revert(
		context.TODO(),
		"id",
		kuuzuki.SessionRevertParams{
			MessageID: kuuzuki.F("msg"),
			PartID:    kuuzuki.F("prt"),
		},
	)
	if err != nil {
		var apierr *kuuzuki.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

func TestSessionShare(t *testing.T) {
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
	_, err := client.Session.Share(context.TODO(), "id")
	if err != nil {
		var apierr *kuuzuki.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

func TestSessionSummarize(t *testing.T) {
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
	_, err := client.Session.Summarize(
		context.TODO(),
		"id",
		kuuzuki.SessionSummarizeParams{
			ModelID:    kuuzuki.F("modelID"),
			ProviderID: kuuzuki.F("providerID"),
		},
	)
	if err != nil {
		var apierr *kuuzuki.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

func TestSessionUnrevert(t *testing.T) {
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
	_, err := client.Session.Unrevert(context.TODO(), "id")
	if err != nil {
		var apierr *kuuzuki.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

func TestSessionUnshare(t *testing.T) {
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
	_, err := client.Session.Unshare(context.TODO(), "id")
	if err != nil {
		var apierr *kuuzuki.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

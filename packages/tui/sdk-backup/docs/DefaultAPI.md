# \DefaultAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateSession**](DefaultAPI.md#CreateSession) | **Post** /session | Create a new session
[**SendMessage**](DefaultAPI.md#SendMessage) | **Post** /session/{id}/message | Send a message to a session



## CreateSession

> Session CreateSession(ctx).CreateSessionRequest(createSessionRequest).Execute()

Create a new session

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/moikas-code/kuuzuki-sdk-go"
)

func main() {
	createSessionRequest := *openapiclient.NewCreateSessionRequest() // CreateSessionRequest |

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.DefaultAPI.CreateSession(context.Background()).CreateSessionRequest(createSessionRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `DefaultAPI.CreateSession``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateSession`: Session
	fmt.Fprintf(os.Stdout, "Response from `DefaultAPI.CreateSession`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateSessionRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **createSessionRequest** | [**CreateSessionRequest**](CreateSessionRequest.md) |  |

### Return type

[**Session**](Session.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## SendMessage

> map[string]interface{} SendMessage(ctx, id).SendMessageRequest(sendMessageRequest).Execute()

Send a message to a session

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/moikas-code/kuuzuki-sdk-go"
)

func main() {
	id := "id_example" // string |
	sendMessageRequest := *openapiclient.NewSendMessageRequest() // SendMessageRequest |

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.DefaultAPI.SendMessage(context.Background(), id).SendMessageRequest(sendMessageRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `DefaultAPI.SendMessage``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SendMessage`: map[string]interface{}
	fmt.Fprintf(os.Stdout, "Response from `DefaultAPI.SendMessage`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**id** | **string** |  |

### Other Parameters

Other parameters are passed through a pointer to a apiSendMessageRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **sendMessageRequest** | [**SendMessageRequest**](SendMessageRequest.md) |  |

### Return type

**map[string]interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

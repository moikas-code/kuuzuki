# kuuzuki_ai.DefaultApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_session**](DefaultApi.md#create_session) | **POST** /session | Create a new session
[**get_app**](DefaultApi.md#get_app) | **GET** /app | Get application info
[**get_config_providers**](DefaultApi.md#get_config_providers) | **GET** /config/providers | List all providers
[**send_message**](DefaultApi.md#send_message) | **POST** /session/{id}/message | Send a message to a session


# **create_session**
> Session create_session(create_session_request)

Create a new session

### Example


```python
import kuuzuki_ai
from kuuzuki_ai.models.create_session_request import CreateSessionRequest
from kuuzuki_ai.models.session import Session
from kuuzuki_ai.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = kuuzuki_ai.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with kuuzuki_ai.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = kuuzuki_ai.DefaultApi(api_client)
    create_session_request = kuuzuki_ai.CreateSessionRequest() # CreateSessionRequest |

    try:
        # Create a new session
        api_response = api_instance.create_session(create_session_request)
        print("The response of DefaultApi->create_session:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->create_session: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **create_session_request** | [**CreateSessionRequest**](CreateSessionRequest.md)|  |

### Return type

[**Session**](Session.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Session created |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_app**
> App get_app()

Get application info

### Example


```python
import kuuzuki_ai
from kuuzuki_ai.models.app import App
from kuuzuki_ai.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = kuuzuki_ai.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with kuuzuki_ai.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = kuuzuki_ai.DefaultApi(api_client)

    try:
        # Get application info
        api_response = api_instance.get_app()
        print("The response of DefaultApi->get_app:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_app: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

[**App**](App.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Application information |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_config_providers**
> AppProvidersResponse get_config_providers()

List all providers

### Example


```python
import kuuzuki_ai
from kuuzuki_ai.models.app_providers_response import AppProvidersResponse
from kuuzuki_ai.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = kuuzuki_ai.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with kuuzuki_ai.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = kuuzuki_ai.DefaultApi(api_client)

    try:
        # List all providers
        api_response = api_instance.get_config_providers()
        print("The response of DefaultApi->get_config_providers:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_config_providers: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

[**AppProvidersResponse**](AppProvidersResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | List of providers |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **send_message**
> object send_message(id, send_message_request)

Send a message to a session

### Example


```python
import kuuzuki_ai
from kuuzuki_ai.models.send_message_request import SendMessageRequest
from kuuzuki_ai.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = kuuzuki_ai.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with kuuzuki_ai.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = kuuzuki_ai.DefaultApi(api_client)
    id = 'id_example' # str |
    send_message_request = kuuzuki_ai.SendMessageRequest() # SendMessageRequest |

    try:
        # Send a message to a session
        api_response = api_instance.send_message(id, send_message_request)
        print("The response of DefaultApi->send_message:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->send_message: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **str**|  |
 **send_message_request** | [**SendMessageRequest**](SendMessageRequest.md)|  |

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Message sent |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

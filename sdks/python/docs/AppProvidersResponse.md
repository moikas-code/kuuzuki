# AppProvidersResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**providers** | [**List[Provider]**](Provider.md) |  | [optional]
**default** | **Dict[str, str]** |  | [optional]

## Example

```python
from kuuzuki_ai.models.app_providers_response import AppProvidersResponse

# TODO update the JSON string below
json = "{}"
# create an instance of AppProvidersResponse from a JSON string
app_providers_response_instance = AppProvidersResponse.from_json(json)
# print the JSON string representation of the object
print(AppProvidersResponse.to_json())

# convert the object into a dict
app_providers_response_dict = app_providers_response_instance.to_dict()
# create an instance of AppProvidersResponse from a dict
app_providers_response_from_dict = AppProvidersResponse.from_dict(app_providers_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

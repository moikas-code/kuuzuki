# AppPath


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**config** | **str** |  | [optional]
**data** | **str** |  | [optional]
**root** | **str** |  | [optional]
**cwd** | **str** |  | [optional]
**state** | **str** |  | [optional]

## Example

```python
from kuuzuki_ai.models.app_path import AppPath

# TODO update the JSON string below
json = "{}"
# create an instance of AppPath from a JSON string
app_path_instance = AppPath.from_json(json)
# print the JSON string representation of the object
print(AppPath.to_json())

# convert the object into a dict
app_path_dict = app_path_instance.to_dict()
# create an instance of AppPath from a dict
app_path_from_dict = AppPath.from_dict(app_path_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

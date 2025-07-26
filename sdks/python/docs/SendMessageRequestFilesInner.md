# SendMessageRequestFilesInner


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**path** | **str** |  | [optional]
**content** | **str** |  | [optional]

## Example

```python
from kuuzuki_ai.models.send_message_request_files_inner import SendMessageRequestFilesInner

# TODO update the JSON string below
json = "{}"
# create an instance of SendMessageRequestFilesInner from a JSON string
send_message_request_files_inner_instance = SendMessageRequestFilesInner.from_json(json)
# print the JSON string representation of the object
print(SendMessageRequestFilesInner.to_json())

# convert the object into a dict
send_message_request_files_inner_dict = send_message_request_files_inner_instance.to_dict()
# create an instance of SendMessageRequestFilesInner from a dict
send_message_request_files_inner_from_dict = SendMessageRequestFilesInner.from_dict(send_message_request_files_inner_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

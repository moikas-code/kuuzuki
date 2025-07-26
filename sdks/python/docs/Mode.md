# Mode


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**model** | **str** |  | [optional]
**prompt** | **str** |  | [optional]
**tools** | **Dict[str, bool]** |  | [optional]

## Example

```python
from kuuzuki_ai.models.mode import Mode

# TODO update the JSON string below
json = "{}"
# create an instance of Mode from a JSON string
mode_instance = Mode.from_json(json)
# print the JSON string representation of the object
print(Mode.to_json())

# convert the object into a dict
mode_dict = mode_instance.to_dict()
# create an instance of Mode from a dict
mode_from_dict = Mode.from_dict(mode_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

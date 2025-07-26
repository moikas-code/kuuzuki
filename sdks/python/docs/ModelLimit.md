# ModelLimit


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**context** | **float** |  | [optional]
**output** | **float** |  | [optional]

## Example

```python
from kuuzuki_ai.models.model_limit import ModelLimit

# TODO update the JSON string below
json = "{}"
# create an instance of ModelLimit from a JSON string
model_limit_instance = ModelLimit.from_json(json)
# print the JSON string representation of the object
print(ModelLimit.to_json())

# convert the object into a dict
model_limit_dict = model_limit_instance.to_dict()
# create an instance of ModelLimit from a dict
model_limit_from_dict = ModelLimit.from_dict(model_limit_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

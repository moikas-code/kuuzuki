# Model


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **str** |  | [optional]
**name** | **str** |  | [optional]
**release_date** | **str** |  | [optional]
**attachment** | **bool** |  | [optional]
**reasoning** | **bool** |  | [optional]
**temperature** | **bool** |  | [optional]
**tool_call** | **bool** |  | [optional]
**cost** | [**ModelCost**](ModelCost.md) |  | [optional]
**limit** | [**ModelLimit**](ModelLimit.md) |  | [optional]
**options** | **Dict[str, object]** |  | [optional]

## Example

```python
from kuuzuki_ai.models.model import Model

# TODO update the JSON string below
json = "{}"
# create an instance of Model from a JSON string
model_instance = Model.from_json(json)
# print the JSON string representation of the object
print(Model.to_json())

# convert the object into a dict
model_dict = model_instance.to_dict()
# create an instance of Model from a dict
model_from_dict = Model.from_dict(model_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

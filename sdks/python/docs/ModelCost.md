# ModelCost


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**input** | **float** |  | [optional]
**output** | **float** |  | [optional]
**cache_read** | **float** |  | [optional]
**cache_write** | **float** |  | [optional]

## Example

```python
from kuuzuki_ai.models.model_cost import ModelCost

# TODO update the JSON string below
json = "{}"
# create an instance of ModelCost from a JSON string
model_cost_instance = ModelCost.from_json(json)
# print the JSON string representation of the object
print(ModelCost.to_json())

# convert the object into a dict
model_cost_dict = model_cost_instance.to_dict()
# create an instance of ModelCost from a dict
model_cost_from_dict = ModelCost.from_dict(model_cost_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

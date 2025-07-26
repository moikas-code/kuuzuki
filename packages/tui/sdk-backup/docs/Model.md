# Model

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Id** | Pointer to **string** |  | [optional]
**Name** | Pointer to **string** |  | [optional]
**ReleaseDate** | Pointer to **string** |  | [optional]
**Attachment** | Pointer to **bool** |  | [optional]
**Reasoning** | Pointer to **bool** |  | [optional]
**Temperature** | Pointer to **bool** |  | [optional]
**ToolCall** | Pointer to **bool** |  | [optional]
**Cost** | Pointer to [**ModelCost**](ModelCost.md) |  | [optional]
**Limit** | Pointer to [**ModelLimit**](ModelLimit.md) |  | [optional]
**Options** | Pointer to **map[string]interface{}** |  | [optional]

## Methods

### NewModel

`func NewModel() *Model`

NewModel instantiates a new Model object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewModelWithDefaults

`func NewModelWithDefaults() *Model`

NewModelWithDefaults instantiates a new Model object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetId

`func (o *Model) GetId() string`

GetId returns the Id field if non-nil, zero value otherwise.

### GetIdOk

`func (o *Model) GetIdOk() (*string, bool)`

GetIdOk returns a tuple with the Id field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetId

`func (o *Model) SetId(v string)`

SetId sets Id field to given value.

### HasId

`func (o *Model) HasId() bool`

HasId returns a boolean if a field has been set.

### GetName

`func (o *Model) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *Model) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *Model) SetName(v string)`

SetName sets Name field to given value.

### HasName

`func (o *Model) HasName() bool`

HasName returns a boolean if a field has been set.

### GetReleaseDate

`func (o *Model) GetReleaseDate() string`

GetReleaseDate returns the ReleaseDate field if non-nil, zero value otherwise.

### GetReleaseDateOk

`func (o *Model) GetReleaseDateOk() (*string, bool)`

GetReleaseDateOk returns a tuple with the ReleaseDate field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetReleaseDate

`func (o *Model) SetReleaseDate(v string)`

SetReleaseDate sets ReleaseDate field to given value.

### HasReleaseDate

`func (o *Model) HasReleaseDate() bool`

HasReleaseDate returns a boolean if a field has been set.

### GetAttachment

`func (o *Model) GetAttachment() bool`

GetAttachment returns the Attachment field if non-nil, zero value otherwise.

### GetAttachmentOk

`func (o *Model) GetAttachmentOk() (*bool, bool)`

GetAttachmentOk returns a tuple with the Attachment field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAttachment

`func (o *Model) SetAttachment(v bool)`

SetAttachment sets Attachment field to given value.

### HasAttachment

`func (o *Model) HasAttachment() bool`

HasAttachment returns a boolean if a field has been set.

### GetReasoning

`func (o *Model) GetReasoning() bool`

GetReasoning returns the Reasoning field if non-nil, zero value otherwise.

### GetReasoningOk

`func (o *Model) GetReasoningOk() (*bool, bool)`

GetReasoningOk returns a tuple with the Reasoning field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetReasoning

`func (o *Model) SetReasoning(v bool)`

SetReasoning sets Reasoning field to given value.

### HasReasoning

`func (o *Model) HasReasoning() bool`

HasReasoning returns a boolean if a field has been set.

### GetTemperature

`func (o *Model) GetTemperature() bool`

GetTemperature returns the Temperature field if non-nil, zero value otherwise.

### GetTemperatureOk

`func (o *Model) GetTemperatureOk() (*bool, bool)`

GetTemperatureOk returns a tuple with the Temperature field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTemperature

`func (o *Model) SetTemperature(v bool)`

SetTemperature sets Temperature field to given value.

### HasTemperature

`func (o *Model) HasTemperature() bool`

HasTemperature returns a boolean if a field has been set.

### GetToolCall

`func (o *Model) GetToolCall() bool`

GetToolCall returns the ToolCall field if non-nil, zero value otherwise.

### GetToolCallOk

`func (o *Model) GetToolCallOk() (*bool, bool)`

GetToolCallOk returns a tuple with the ToolCall field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetToolCall

`func (o *Model) SetToolCall(v bool)`

SetToolCall sets ToolCall field to given value.

### HasToolCall

`func (o *Model) HasToolCall() bool`

HasToolCall returns a boolean if a field has been set.

### GetCost

`func (o *Model) GetCost() ModelCost`

GetCost returns the Cost field if non-nil, zero value otherwise.

### GetCostOk

`func (o *Model) GetCostOk() (*ModelCost, bool)`

GetCostOk returns a tuple with the Cost field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCost

`func (o *Model) SetCost(v ModelCost)`

SetCost sets Cost field to given value.

### HasCost

`func (o *Model) HasCost() bool`

HasCost returns a boolean if a field has been set.

### GetLimit

`func (o *Model) GetLimit() ModelLimit`

GetLimit returns the Limit field if non-nil, zero value otherwise.

### GetLimitOk

`func (o *Model) GetLimitOk() (*ModelLimit, bool)`

GetLimitOk returns a tuple with the Limit field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLimit

`func (o *Model) SetLimit(v ModelLimit)`

SetLimit sets Limit field to given value.

### HasLimit

`func (o *Model) HasLimit() bool`

HasLimit returns a boolean if a field has been set.

### GetOptions

`func (o *Model) GetOptions() map[string]interface{}`

GetOptions returns the Options field if non-nil, zero value otherwise.

### GetOptionsOk

`func (o *Model) GetOptionsOk() (*map[string]interface{}, bool)`

GetOptionsOk returns a tuple with the Options field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOptions

`func (o *Model) SetOptions(v map[string]interface{})`

SetOptions sets Options field to given value.

### HasOptions

`func (o *Model) HasOptions() bool`

HasOptions returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

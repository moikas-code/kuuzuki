# CreateSessionRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ProviderID** | Pointer to **string** |  | [optional]
**Model** | Pointer to **string** |  | [optional]
**System** | Pointer to **string** |  | [optional]

## Methods

### NewCreateSessionRequest

`func NewCreateSessionRequest() *CreateSessionRequest`

NewCreateSessionRequest instantiates a new CreateSessionRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCreateSessionRequestWithDefaults

`func NewCreateSessionRequestWithDefaults() *CreateSessionRequest`

NewCreateSessionRequestWithDefaults instantiates a new CreateSessionRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetProviderID

`func (o *CreateSessionRequest) GetProviderID() string`

GetProviderID returns the ProviderID field if non-nil, zero value otherwise.

### GetProviderIDOk

`func (o *CreateSessionRequest) GetProviderIDOk() (*string, bool)`

GetProviderIDOk returns a tuple with the ProviderID field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetProviderID

`func (o *CreateSessionRequest) SetProviderID(v string)`

SetProviderID sets ProviderID field to given value.

### HasProviderID

`func (o *CreateSessionRequest) HasProviderID() bool`

HasProviderID returns a boolean if a field has been set.

### GetModel

`func (o *CreateSessionRequest) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *CreateSessionRequest) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *CreateSessionRequest) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *CreateSessionRequest) HasModel() bool`

HasModel returns a boolean if a field has been set.

### GetSystem

`func (o *CreateSessionRequest) GetSystem() string`

GetSystem returns the System field if non-nil, zero value otherwise.

### GetSystemOk

`func (o *CreateSessionRequest) GetSystemOk() (*string, bool)`

GetSystemOk returns a tuple with the System field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSystem

`func (o *CreateSessionRequest) SetSystem(v string)`

SetSystem sets System field to given value.

### HasSystem

`func (o *CreateSessionRequest) HasSystem() bool`

HasSystem returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

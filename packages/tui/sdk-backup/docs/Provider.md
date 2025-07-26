# Provider

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Api** | Pointer to **string** |  | [optional]
**Name** | Pointer to **string** |  | [optional]
**Env** | Pointer to **[]string** |  | [optional]
**Id** | Pointer to **string** |  | [optional]
**Npm** | Pointer to **string** |  | [optional]
**Models** | Pointer to [**map[string]Model**](Model.md) |  | [optional]

## Methods

### NewProvider

`func NewProvider() *Provider`

NewProvider instantiates a new Provider object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewProviderWithDefaults

`func NewProviderWithDefaults() *Provider`

NewProviderWithDefaults instantiates a new Provider object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetApi

`func (o *Provider) GetApi() string`

GetApi returns the Api field if non-nil, zero value otherwise.

### GetApiOk

`func (o *Provider) GetApiOk() (*string, bool)`

GetApiOk returns a tuple with the Api field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetApi

`func (o *Provider) SetApi(v string)`

SetApi sets Api field to given value.

### HasApi

`func (o *Provider) HasApi() bool`

HasApi returns a boolean if a field has been set.

### GetName

`func (o *Provider) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *Provider) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *Provider) SetName(v string)`

SetName sets Name field to given value.

### HasName

`func (o *Provider) HasName() bool`

HasName returns a boolean if a field has been set.

### GetEnv

`func (o *Provider) GetEnv() []string`

GetEnv returns the Env field if non-nil, zero value otherwise.

### GetEnvOk

`func (o *Provider) GetEnvOk() (*[]string, bool)`

GetEnvOk returns a tuple with the Env field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEnv

`func (o *Provider) SetEnv(v []string)`

SetEnv sets Env field to given value.

### HasEnv

`func (o *Provider) HasEnv() bool`

HasEnv returns a boolean if a field has been set.

### GetId

`func (o *Provider) GetId() string`

GetId returns the Id field if non-nil, zero value otherwise.

### GetIdOk

`func (o *Provider) GetIdOk() (*string, bool)`

GetIdOk returns a tuple with the Id field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetId

`func (o *Provider) SetId(v string)`

SetId sets Id field to given value.

### HasId

`func (o *Provider) HasId() bool`

HasId returns a boolean if a field has been set.

### GetNpm

`func (o *Provider) GetNpm() string`

GetNpm returns the Npm field if non-nil, zero value otherwise.

### GetNpmOk

`func (o *Provider) GetNpmOk() (*string, bool)`

GetNpmOk returns a tuple with the Npm field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetNpm

`func (o *Provider) SetNpm(v string)`

SetNpm sets Npm field to given value.

### HasNpm

`func (o *Provider) HasNpm() bool`

HasNpm returns a boolean if a field has been set.

### GetModels

`func (o *Provider) GetModels() map[string]Model`

GetModels returns the Models field if non-nil, zero value otherwise.

### GetModelsOk

`func (o *Provider) GetModelsOk() (*map[string]Model, bool)`

GetModelsOk returns a tuple with the Models field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModels

`func (o *Provider) SetModels(v map[string]Model)`

SetModels sets Models field to given value.

### HasModels

`func (o *Provider) HasModels() bool`

HasModels returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

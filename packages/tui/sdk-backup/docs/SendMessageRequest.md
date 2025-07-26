# SendMessageRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Text** | Pointer to **string** |  | [optional]
**Files** | Pointer to [**[]SendMessageRequestFilesInner**](SendMessageRequestFilesInner.md) |  | [optional]

## Methods

### NewSendMessageRequest

`func NewSendMessageRequest() *SendMessageRequest`

NewSendMessageRequest instantiates a new SendMessageRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewSendMessageRequestWithDefaults

`func NewSendMessageRequestWithDefaults() *SendMessageRequest`

NewSendMessageRequestWithDefaults instantiates a new SendMessageRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetText

`func (o *SendMessageRequest) GetText() string`

GetText returns the Text field if non-nil, zero value otherwise.

### GetTextOk

`func (o *SendMessageRequest) GetTextOk() (*string, bool)`

GetTextOk returns a tuple with the Text field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetText

`func (o *SendMessageRequest) SetText(v string)`

SetText sets Text field to given value.

### HasText

`func (o *SendMessageRequest) HasText() bool`

HasText returns a boolean if a field has been set.

### GetFiles

`func (o *SendMessageRequest) GetFiles() []SendMessageRequestFilesInner`

GetFiles returns the Files field if non-nil, zero value otherwise.

### GetFilesOk

`func (o *SendMessageRequest) GetFilesOk() (*[]SendMessageRequestFilesInner, bool)`

GetFilesOk returns a tuple with the Files field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFiles

`func (o *SendMessageRequest) SetFiles(v []SendMessageRequestFilesInner)`

SetFiles sets Files field to given value.

### HasFiles

`func (o *SendMessageRequest) HasFiles() bool`

HasFiles returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

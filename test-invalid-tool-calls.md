# Test Invalid Tool Call Scenarios

## Test Cases for Enhanced Error Handling

### Test Case 1: Invalid JSON in Tool Call

Try to make the AI call a tool with malformed JSON arguments.

**Prompt**: "Please read a file, but use invalid JSON format for the arguments"

**Expected**: The invalid tool call should be captured and displayed with clear error message.

### Test Case 2: Wrong Parameter Types

Try to make the AI pass wrong types to tool parameters.

**Prompt**: "Use the read tool with offset as a string instead of number"

**Expected**: Type validation error should be captured and shown clearly.

### Test Case 3: Missing Required Parameters

Try to make the AI call a tool without required parameters.

**Prompt**: "Use the read tool without specifying a filePath"

**Expected**: Missing parameter error should be captured and displayed.

### Test Case 4: Non-existent Tool

Try to make the AI call a tool that doesn't exist.

**Prompt**: "Use the nonexistent tool to do something"

**Expected**: Tool not found error should be handled gracefully.

### Test Case 5: Extra Unknown Parameters

Try to make the AI pass parameters that don't exist in the tool schema.

**Prompt**: "Use the read tool with an unknown parameter called 'invalidParam'"

**Expected**: Unknown parameter should be filtered out or error handled.

## Manual Testing Steps

1. Start kuuzuki TUI: `./bin/kuuzuki tui`
2. Try each test case above
3. Verify that:
   - Invalid tool calls are captured
   - Error messages are clear and helpful
   - Original tool name is preserved in display
   - AI model receives structured error information
   - Normal tool calls continue to work

## Success Criteria

- ✅ Invalid tool calls show "Invalid [OriginalTool]" in TUI
- ✅ Error messages explain what went wrong
- ✅ AI models can learn from the error feedback
- ✅ No crashes or system instability
- ✅ Normal tool calls work as expected

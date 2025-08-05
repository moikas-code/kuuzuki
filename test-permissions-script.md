# 🧪 TUI Permissions Testing Script

## Test Cases to Try

### 1. **Keyboard Shortcuts Test**

```
In TUI, type: "run rm -rf node_modules"
Expected: Permission dialog appears
Test:
- Press `Enter` → Should accept once
- Press `A` → Should accept always
- Press `Esc` → Should reject
```

### 2. **Dangerous Command Detection**

```
In TUI, type: "run rm -rf important_folder"
Expected:
- ⚠️ Warning icon appears
- Orange/red border color
- "kuuzuki Permission Required" title
```

### 3. **Tool-Specific Icons**

```
Try these commands:
- "run ls" → Should show ⚡ icon
- "edit test.txt" → Should show ✏️ icon
- "write new_file.txt" → Should show 📝 icon
```

### 4. **kuuzuki Theming**

```
Expected visual elements:
- 🔒 "kuuzuki Permission Required" title
- kuuzuki accent colors (purple/blue)
- Panel background for better contrast
- Clear help text: "⚡ [Enter] Accept Once  🔄 [A] Always  ❌ [Esc] Reject"
```

### 5. **Pattern-Based Approval**

```
1. Type: "run rm test1.txt" → Press `A` (Always)
2. Type: "run rm test2.txt" → Should auto-approve (pattern remembered)
3. Verify kuuzuki's smart pattern system still works
```

## Expected Results

✅ **Success Indicators:**

- Permission dialogs appear for configured commands
- Keyboard shortcuts work as expected
- kuuzuki branding and theming visible
- Dangerous commands show warnings
- Tool icons display correctly
- Pattern-based approval works

❌ **Issues to Watch For:**

- Dialog doesn't appear
- Keyboard shortcuts don't work
- Theming looks wrong
- Server connection errors
- Build/compilation errors

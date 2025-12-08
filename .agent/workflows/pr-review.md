---
description: Pre-merge review - architecture, UI, security
---

# PR Review Workflow

Comprehensive check before merging changes.

---

## Step 1: Architecture Review
```
@reis-guardian review <changed-files>
```

Check:
- [ ] No UI in content script
- [ ] Message origin validation
- [ ] StorageService usage (no raw chrome.storage)
- [ ] Asset URLs via chrome.runtime.getURL
- [ ] Types from src/types/

---

## Step 2: UI Compliance
```
@daisy-enforcer scan <changed-files>
```

Check:
- [ ] DaisyUI components over raw Tailwind
- [ ] Semantic colors (no hex codes)
- [ ] No inline styles for static layout

---

## Step 3: Security (if applicable)
```
@reis-guardian audit security
```

Check:
- [ ] No XSS vectors (dangerouslySetInnerHTML)
- [ ] No credential storage
- [ ] CSP compliance

---

## Step 4: Parser Observability (if parsers changed)
```
@reis-guardian audit parsers
```

Check:
- [ ] Entry logging
- [ ] Result logging
- [ ] Edge case handling

---

## Quick Commands

| Command | Purpose |
|---------|---------|
| `/pr-review` | Full review |
| `@reis-guardian review src/components/...` | Architecture check |
| `@daisy-enforcer scan src/components/...` | UI check |

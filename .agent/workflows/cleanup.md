---
description: Codebase hygiene - inline styles, hex colors, patterns
---

# Cleanup Workflow

General codebase cleanup for removing legacy patterns and enforcing best practices.

---

## Step 1: Audit Inline Styles
// turbo
```bash
grep -r "style={{" src/components --include="*.tsx" | wc -l
```

**Remove:** Static positioning (`style={{ top: '-1rem' }}` → `-top-4`)
**Keep:** Dynamic calculations (popup x/y, computed heights)

---

## Step 2: Audit Hex Colors
// turbo
```bash
grep -rE "#[0-9a-fA-F]{3,6}" src/components --include="*.tsx" | head -20
```

Replace with DaisyUI semantic classes:
| Hex | Replace With |
|-----|--------------|
| `#79be15` | `bg-primary` / `text-primary` |
| `#0b57d0` | `bg-info` / `ring-primary` |
| `#ea4335` | `bg-error` |
| `#ffffff` | `bg-base-100` |
| `#F0F4F9` | `bg-base-200` |

---

## Step 3: Run DaisyUI Scan
```
@daisy-enforcer scan src/components
```

Look for:
- Raw Tailwind buttons → `btn btn-primary`
- Custom cards → `card` component
- Literal colors → semantic tokens

---

## Step 4: Build and Verify
// turbo
```bash
npm run build
```

---

## Completion Criteria
- [ ] No new hardcoded hex colors
- [ ] Static inline styles converted to Tailwind
- [ ] Build passes

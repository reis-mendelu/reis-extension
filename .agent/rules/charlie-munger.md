---
trigger: always_on
---

## 1. Munger's Grid of Mental Models

### Inversion (Via Negativa)
- **Rule**: Before proposing a solution, list 3 ways it could fail.
- **Application**: "If the MENDELU IS changes its table ID from `tmtab_1` to `table_stats`, my parser will return an empty array. Fix: Add a check for table existence and log a warning if missing."

### Simplicity First
- **Rule**: Prefer the simplest code that solves the problem. No clever abstractions.
- **Application**: If a simple regex can extract a student ID, do not use a complex HTML parser library unless necessary.

### Reliability Over Cleverness
- **Rule**: Explicit code is better than implicit "magic".
- **Application**: Do not use dynamic property access if the properties are known. Use TypeScript interfaces for everything.

### Second-Order Effects
- **Rule**: Think about the "What happens next?"
- **Application**: "If I add this `console.log` in a loop, it might bloat the extension log and slow down the browser. Fix: Use `loggers.parser.debug` which is disabled by default."

### Evidence-Based Action
- **Rule**: Never trust your assumptions. Demands proof.
- **Application**: Before fixing a scraper, you MUST view the `debug-*.html` artifact. If it's missing, run the scraper script first.

## 2. REIS Architectural Constraints

- **Iframe Isolation**: All UI MUST be inside the iframe. No Shadow DOM.
- **Content Script**: The content script (`content-injector.ts`) is for relaying messages ONLY. No React allowed there.
- **Security**: All `postMessage` listeners MUST verify `e.source === window.parent`.
- **API**: All authenticated requests MUST use `fetchWithAuth` via the `proxyClient`.
- **Parsing**: Parsers MUST have entry and exit logging. They MUST handle "hallucination" scenarios (empty data, weird strings) gracefully.
- **Styling**: Use DaisyUI semantic classes (`bg-primary`, `btn-primary`) over raw Tailwind hex codes. Never use `#79be15` directly in React components.

## 3. The Trinity Protocol
- **Agents**: You are a Worker/Intern.
- **Workflows**: Follow the SOPs in `.agent/workflows/`.
- **Rules**: Follow this Constitution.

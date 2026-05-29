---
name: "speckit-compress-mem"
description: "Compress .specify/memory/ files — remove filler, keep meaning. Use when user asks to compress, nén, or optimize memory files for AI readability."
argument-hint: "Optional: specific file names to compress, or 'all' for everything"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

## Scope

Target: `.specify/memory/*.md` files (speckit project knowledge).
If user specifies file names, compress only those. Otherwise compress all.

## Compression Rules

### 1. Classify each file

| Type | Example | Compression level |
|---|---|---|
| **Governance** | constitution.md | Light — keep declarative prose, MUST/SHOULD language, principle structure readable by humans |
| **Reference** | schema, permissions, build, test, workflow | Heavy — optimize for AI token efficiency, strip all filler |

### 2. Abbreviation legend

Define abbreviations ONCE in `constitution.md` under `## Abbreviations`.
All other files reference it: `> Abbreviations: see constitution.md`

Common abbreviations for this project:
GĐ, PGĐ, VT, TP, PP, NV, PT, PH, NCC, AT, RT.

If new domain terms repeat 3+ times across files, add to the legend.

### 3. Compression techniques (Reference files)

Apply in order:

**Remove filler words:**
- "This constraint is non-negotiable and drives every architectural decision" → delete (context implies it)
- "It is important to note that" → delete
- "In order to" → "to"
- "the following" → delete or restructure

**Merge redundant sentences:**
- Before: "CacheService is per-script. It is not shared across scripts. That's why ATs are written to both cache and sheet."
- After: "CacheService per-script → AT written to cache(fast) + sheet(cross-script)."

**Inline key→value for short items:**
- Before:
  ```
  | Key | Purpose |
  | SSO_PARENT_SHEET_ID | Parent SSO sheet |
  | ROOT_FOLDER_ID | Drive folder |
  ```
- After: `SSO_PARENT_SHEET_ID, ROOT_FOLDER_ID, COMPANY_NAME, APP_URL, MAIL_TEMPLATES(JSON), SCHEMA_V(bump→re-init).`

**Compact tables** — keep tables only when 3+ columns with real data. 2-column tables → inline or definition list.

**Collapse enumerations:**
- Before: "SpreadsheetApp, CacheService, LockService, PropertiesService, DriveApp, Utilities, HtmlService, ScriptApp, Session, GmailApp"
- After: keep as-is (already a list), but remove per-item descriptions if obvious from name

**Use abbreviations** defined in constitution.

**Flow compression:**
- Before: "User submits email and password. The system computes SHA-256 of username plus password. Then it determines the label based on device type."
- After: "SHA-256(username+password) → label=desktop|mobile → revoke prev AT → bumpEpochDevice → mintRT → mintAT"

### 4. Compression techniques (Governance files)

Light touch only:

- Remove HTML comments and example placeholders
- Remove redundant explanations where the rule itself is clear
- Keep MUST/SHOULD/MUST NOT language
- Keep principle names and structure
- Keep code examples if they illustrate a pattern (e.g., override pattern)
- Allowed: tighten sentences, remove "that is to say" / "in other words"
- NOT allowed: collapse principles into bullet-only format, remove rationale

### 5. Preserve invariants

These MUST survive compression:

- All sheet names and column names (exact Vietnamese strings)
- All function names and module names
- All file paths
- All numeric values (TTL, priorities, limits)
- All status names in workflows
- All role names and priority numbers
- All color hex values
- All command strings (`npm run ...`, etc.)
- Referential relationships between concepts

### 6. Do NOT compress

- Code blocks / code examples
- Mermaid diagrams
- URLs and paths
- Version numbers

## Execution

1. Read all target files. Count total lines (before).
2. For each file:
   a. Classify as governance or reference.
   b. Apply appropriate compression level.
   c. Write compressed version.
3. Count total lines (after).
4. Report: per-file before/after + total reduction percentage.
5. If abbreviation legend needs updating, update `constitution.md`.

## Quality Check

After compression, verify:
- Every fact from the original is present in compressed version.
- No ambiguity introduced by removing context.
- Abbreviations used are defined in constitution legend.
- Files still parseable as standalone documents (no dangling references
  to removed context).

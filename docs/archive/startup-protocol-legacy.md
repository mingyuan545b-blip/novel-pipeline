# AI Session Startup Protocol

**This file MUST be read at the start of every new session.**

## Absolute Rules (Violation = Stop and Report)

1. **FAILED is never normal** — Any FAILED status in preflight/postflight/pollution check must be investigated to root cause. No "normal degradation" excuses.
2. **genre=null means writer is running naked** — No genre = no constraints = guaranteed output drift. Must fix before proceeding.
3. **Use `resolveGenreFromProject(project)`** — NEVER call `detectGenre(project.styleProfile)` directly. The unified function handles subGenre/styleProfile/genre fallback chain.
4. **End-to-end verification required** — After any code change, must verify with actual project data, not just unit tests.
5. **No "should be fine"** — If you can't verify it, it's not done. State explicitly what's verified and what's not.

## Data Format Requirements

### Project styleProfile Schema (MUST be followed)
```json
{
  "key": "tomato-sweet-artisan",        // genre plugin ID (required)
  "genre": "甜宠匠心",                    // Chinese genre name
  "genreProfile": "甜宠匠心",             // genreProfileRegistry ID
  "style": "诗意意象",
  "tone": "甜蜜微虐烟火气",
  "pov": "第三人称双视角"
}
```

### Project subGenre Field
- MUST use camelCase: `subGenre` (not `subgenre`)
- Value MUST be genre plugin ID (e.g., "tomato-sweet-artisan"), not Chinese name
- Code MUST handle both `subGenre` and `subgenre` for backward compatibility

## Genre Detection Priority (resolveGenreFromProject)
1. `project.subGenre` or `project.subgenre` → `getGenreById()`
2. `project.styleProfile` → `detectGenre()`
3. `project.genre` → `getGenreById()` then `detectGenre({genre})`

## Known Anti-Patterns (MUST AVOID)
- ❌ `detectGenre(project.styleProfile)` — may return null if format mismatch
- ❌ `getGenrePlugin(project.genre)` — project.genre is Chinese string, not styleProfile object
- ❌ Treating review rejection as normal — qwen3.6-plus is strong, rejection means prompt problem
- ❌ Skipping end-to-end verification after code changes

## Relationship Stage Guard
- Writer and reviser prompts MUST include relationship stage guard
- Guard is injected at the TOP of the prompt, before any other instructions
- Guard priority: relationship stage > style rules > genre rules > default rules

# Version History — `generate-test-cases`

- **1.0.0** (2026-05-08): Initial stable release
  - Input modes: `--from-jira`, `--from-text`, `--from-markdown`
  - Output adapters: `--to-qase`, `--to-jira`, `--to-testrail`, `--to-xray`, `--to-markdown`, plus display-only fallback
  - Canonical test case format with classic and gherkin step styles
  - Progressive disclosure architecture: adapter files loaded on-demand by `--to-*` flag, references loaded conditionally per phase
  - Always-loaded references (test-design techniques, quality checks) inlined into SKILL.md for zero-latency access
  - Per-step progress announcements (`⏳` / `✓`) across all phases to eliminate silent gaps
  - Extensibility guide for adding new output adapters
  - Format preference persistence via `generate-test-cases.json`

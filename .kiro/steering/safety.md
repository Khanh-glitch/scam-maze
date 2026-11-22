# SCAMMAZE — Safety rules

- Never state or imply that a URL, message or website is "safe". "No bad signals found" is NOT "safe".
- URL analysis is string-only: never fetch, load, embed or redirect to a user-provided or scenario URL.
- Scenario domains (reserved, real or look-alike, see `audience.md`) are display text only: never render them as clickable links and never load them.
- The core game and rules must work with AI disabled and offline; AI is an optional layer.

# Looma 0.3 validation

- TypeScript typecheck passed.
- 28 Node tests passed, including fixed provider routing, missing-key behavior, credential redaction, question-only requests and the Loom task-routing regression.
- 84 Python tests and 22 subtests passed.
- Production Next.js static export and Electron/PyInstaller builds passed.
- Isolated Electron companion smoke test passed.
- Packaged workspace smoke test passed: authentication, anonymous API rejection, renderer isolation, model selection transport, provider tabs and the MCP Plugins UI.
- Live Loom authentication and tool discovery succeeded; the repaired task route returned a formatted table. No task contents were logged or sent to cloud models.
- Mac DMG checksum and deep ad-hoc signature verification passed.

OpenAI, xAI, DeepSeek and Anthropic adapters were tested with mocked responses. Their live inference requires the user's provider keys. Composio integrations require a key and account authorization; the catalogue no longer pretends that enabling a preview connects an account. The Mac build is not Apple-notarized. Windows configuration is present but this release was built on Apple Silicon macOS.

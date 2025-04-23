# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-04-23

### Added

-   Initial release of the FileSearch MCP Server.
-   `retrieveDocs` tool to query OpenAI File Search via the Responses API.
-   Configuration loading from `config.json` and environment variables (`OPENAI_API_KEY`, `DEBUG_OPENAI`).
-   Structured error handling (`McpError`) for OpenAI API issues.
-   Retry logic with exponential backoff for transient OpenAI errors.
-   Timeout (30s) for OpenAI API requests.
-   Basic README with setup and usage instructions.
-   `.gitignore` for Node.js projects, including `.env` and `config.json`.
-   `LICENSE` file (MIT).
-   ESLint and Prettier for code linting and formatting.
-   `.env.example` and `config.template.json` for user configuration.

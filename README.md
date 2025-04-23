# FileSearch MCP Server

A minimal FastMCP 2.x server in TypeScript that exposes one RPC—`retrieveDocs(question)`—which returns raw ranked chunks from OpenAI File Search.

## Features

- Acts as a simple proxy to OpenAI's `/v1/responses` endpoint using the `file_search` tool.
- Reads `OPENAI_API_KEY` from environment variables.
- Reads `vectorStoreId` from `config.json`.
- Uses FastMCP 2.x with `addTool` and `ctx.log`.
- Returns raw chunks (`{ id, text, score }[]`) as a JSON string, extracted from `file_search_call.results`.
- Includes robustness features: 30s timeout, retry logic (3 attempts) for transient errors (429, 5xx, network), and structured error reporting.
- Optional verbose logging via `DEBUG_OPENAI` environment variable.

## Prerequisites

- Node.js (v18 or later recommended)
- npm (or pnpm/yarn)
- An OpenAI API Key
- An existing OpenAI Vector Store ID
- Git (for cloning)

## Setup

1.  **Clone the repository (if applicable):**

    ```bash
    # git clone <repository-url>
    # cd filesearch-mcp-server
    ```

2.  **Install dependencies:** Installs required packages.

    ```bash
    npm install
    ```

3.  **Configure:**

    - **`config.json`:** Copy `config.template.json` to `config.json` and add your Vector Store ID.

      ```bash
      cp config.template.json config.json
      ```
      Then edit `config.json`:
      ```json
      {
        "vectorStoreId": "vs_YOUR_VECTOR_STORE_ID"
      }
      ```
      _(Replace `vs_YOUR_VECTOR_STORE_ID` with your actual ID. This file is ignored by git via `.gitignore`.)_

    - **Environment Variables:** Create a `.env` file (or set environment variables directly). You can copy the example:

      ```bash
      cp .env.example .env
      ```
      Then edit `.env` with your API key:
      ```dotenv
      # Required: Your OpenAI API Key
      OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

      # Optional: Set to "true" or "1" for verbose OpenAI API response logging
      # DEBUG_OPENAI=false
      ```
      _(This file is ignored by git via `.gitignore`.)_

      **Alternatively, configure via Cline MCP Settings (`cline_mcp_setting.json`):**

      ```json
      {
        "servers": [
          {
            "id": "filesearch-mcp-server",
            "command": "npm start",
            "working_directory": "path/to/filesearch-mcp-server",
            "environment": {
              "OPENAI_API_KEY": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
              "DEBUG_OPENAI": "false"
            }
          }
        ]
      }
      ```

4.  **Build the TypeScript code:**
    ```bash
    npm run build
    ```

## Running the Server

```bash
npm start
```

This command runs `node dist/server.js`, starting the server using the `stdio` transport (default). It listens for MCP requests on standard input/output, making it suitable for use with Cline or other MCP clients expecting stdio communication.

## Development

-   **Build:** `npm run build` (Compiles TypeScript to `dist/`)
-   **Format:** `npm run format` (Formats code with Prettier)
-   **Lint:** `npm run lint` (Checks code style with ESLint)
-   **Watch & Run:** `npm run dev` (Watches for changes, rebuilds, and restarts the server)

## Chunk Structure

The server extracts chunks from the `output[*].file_search_call.results` field in the OpenAI API response. Each chunk in the returned JSON array follows the `Chunk` interface: `{ id: string, text: string, score: number }`. The `id` is taken from the result object's `id` field (with a fallback), `text` is the chunk content, and `score` is the relevance score provided by OpenAI.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

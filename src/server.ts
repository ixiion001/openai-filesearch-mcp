import { FastMCP, type Context } from "fastmcp"; // Use Context for type hint, REMOVED McpError import
import { z } from "zod";
import { loadConfig } from "./config.js";
import type {
  Chunk,
  OpenAiFileSearchResponse,
  AppConfig,
  McpError,
  OutputItem, // Add OutputItem
  SearchResultItem, // Add SearchResultItem
} from "./types.js";

// --- Helper Functions ---

/**
 * Maps various error types to a structured McpError object.
 * @param error The error object (can be Error, Response, or other).
 * @returns A structured McpError object.
 */
async function toMcpError(error: unknown): Promise<McpError> {
  // Use unknown for safer type handling
  if (error instanceof Error && error.name === "AbortError") {
    // Check if it's an Error first
    return {
      code: "OPENAI_TIMEOUT",
      message: "OpenAI API request timed out after 30 seconds.",
    };
  }

  if (error instanceof Response) {
    // Handle HTTP errors from fetch response
    const status = error.status;
    let errorText = "Could not read error response body.";
    try {
      errorText = await error.text();
    } catch (readError) {
      console.error("Failed to read error response body:", readError);
    }

    if (status === 429) {
      return {
        code: "OPENAI_RATE_LIMIT",
        message: "OpenAI API rate limit exceeded.",
        details: { status, errorText },
      };
    } else if (status >= 500) {
      return {
        code: "OPENAI_UPSTREAM_ERROR",
        message: "OpenAI API returned an upstream server error.",
        details: { status, errorText },
      };
    } else {
      // Treat other non-ok statuses (e.g., 400, 401, 403) as internal issues for this proxy
      return {
        code: "INTERNAL_SERVER_ERROR",
        message: `OpenAI API request failed with status ${status}.`,
        details: { status, errorText },
      };
    }
  }

  if (error instanceof Error) {
    // Handle generic JavaScript errors (likely network issues before response)
    // Check if it might be a fetch-related network error (common type)
    if (error.message.includes("fetch failed") || error.name === "TypeError") {
      // TypeError can occur for network issues in some Node versions
      return {
        code: "OPENAI_NETWORK_ERROR",
        message: error.message ?? "Network error during OpenAI API request.",
      };
    }
    // Otherwise, treat as a general internal error
    return {
      code: "INTERNAL_SERVER_ERROR",
      message: error.message ?? "An unexpected server error occurred.",
    };
  }

  // Fallback for unknown error types
  return {
    code: "INTERNAL_SERVER_ERROR",
    message: "An unknown error occurred.",
    details: String(error), // Convert unknown error to string for details
  };
}

/**
 * Simple delay function using Promises.
 * @param ms Milliseconds to delay.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Main Application ---

async function main() {
  let config: AppConfig;
  try {
    config = loadConfig(); // Removed await, loadConfig is synchronous
  } catch (error: unknown) {
    // Use unknown for safer error handling
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to load configuration:", message);
    process.exit(1); // Exit if config fails
  }

  const server = new FastMCP({
    name: "FileSearch-MCP-Server",
    version: "1.0.0",
    // No authentication needed as per requirements
  });

  // --- Tool Implementation ---

  server.addTool({
    name: "retrieveDocs",
    description:
      "Retrieves raw ranked chunks from OpenAI File Search based on a question.",
    parameters: z.object({
      question: z.string().min(1, "Question cannot be empty."),
    }),
    // Define the execute function for the tool - returns JSON string
    execute: async (
      args: { question: string },
      ctx: Context<undefined>
    ): Promise<string> => {
      // Reverted return type to string
      // Access validated args directly
      const { question } = args;
      // Access context for logging (now correctly typed as Context<undefined>)
      ctx.log.info(`Received retrieveDocs request for input: "${question}"`); // Log input
      const startTime = Date.now();

      // Match the structure from the documentation
      const requestBody = {
        model: "gpt-4.1-mini",
        input: question, // Use 'input' instead of 'query'
        include: ["file_search_call.results"], // Added include parameter
        tools: [
          {
            // Use 'tools' array
            type: "file_search",
            vector_store_ids: [config.vectorStoreId],
            max_num_results: 20, // Keep max_num_results inside the tool object
          },
        ],
        // Removed top-level tool, vector_store_ids, and tool_choice
      };

      const maxAttempts = 3;
      const baseDelay = 500; // ms

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout for each attempt

        try {
          ctx.log.debug(
            `Attempt ${attempt + 1}/${maxAttempts}: Sending request to OpenAI API...`
          );
          const response = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            signal: controller.signal, // Pass the abort signal for this attempt
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.openaiApiKey}`,
              "OpenAI-Beta": "responses=v1", // Added Beta header
            },
            body: JSON.stringify(requestBody),
          });
          clearTimeout(timeoutId); // Clear the timeout if fetch completes successfully

          const duration = Date.now() - startTime; // Total duration so far
          ctx.log.debug(
            `Attempt ${attempt + 1}: Response status ${response.status} received after ${duration}ms total.`
          );

          // Log warning for slow requests (might log multiple times if retrying)
          if (duration > 25000) {
            ctx.log.warn(
              `Attempt ${attempt + 1}: OpenAI API request duration > 25 seconds: ${duration}ms`
            );
          }

          if (!response.ok) {
            // For non-OK responses throw the raw response object so the
            // surrounding catch block can convert it via `toMcpError`.
            throw response;
          }

          // --- SUCCESS PATH ---
          const responseData =
            (await response.json()) as OpenAiFileSearchResponse; // Type assertion

          // Conditionally log the entire raw response data for debugging
          if (config.debugOpenai) {
            ctx.log.debug(
              "Raw OpenAI API response data:",
              JSON.stringify(responseData, null, 2)
            );
          }

          // --- New Chunk Extraction Logic (from file_search_call.results) ---
          const chunks: Chunk[] = [];
          ctx.log.debug(
            "Processing OpenAI response for file_search_call results..."
          );

          // Use specific types OutputItem and SearchResultItem
          (responseData.output ?? []).forEach((item: OutputItem) => {
            // Check if the item is a file search call and has results
            if (
              item.type === "file_search_call" &&
              Array.isArray(item.results)
            ) {
              item.results.forEach((r: SearchResultItem) => {
                // Extract chunk details, using nullish coalescing for safety
                const chunk: Chunk = {
                  // Use chunk_id if available, otherwise fallback to id, or generate one?
                  // For now, assuming 'id' exists on the result object 'r' based on typical API patterns
                  // If 'chunk_id' is the correct field, adjust accordingly. Let's assume 'id' for now.
                  id:
                    r.id ??
                    `unknown_id_${Math.random().toString(36).substring(2, 15)}`, // Use result id or generate fallback
                  text: r.text ?? "", // Text content of the chunk
                  score: r.score ?? 0, // Relevance score
                };
                chunks.push(chunk);
                ctx.log.debug("Extracted chunk:", {
                  id: chunk.id,
                  score: chunk.score,
                });
              });
            }
          });
          ctx.log.debug(
            `Extracted ${chunks.length} chunks from file_search_call results.`
          );
          // --- End New Chunk Extraction Logic ---

          ctx.log.info(
            `Successfully processed response, returning ${chunks.length} chunks as JSON string. Total time: ${duration}ms.`
          );
          // Return the successful result as a JSON string
          return JSON.stringify(chunks);
        } catch (error: unknown) {
          // Use unknown for safer error handling
          clearTimeout(timeoutId); // Clear timeout on error for this attempt
          const mcpError = await toMcpError(error); // Ensure error is structured

          ctx.log.warn(
            `Attempt ${attempt + 1}/${maxAttempts} failed: ${mcpError.code} - ${mcpError.message}`
          );

          // Check if retryable and if more attempts are left
          const isRetryable = [
            "OPENAI_RATE_LIMIT",
            "OPENAI_UPSTREAM_ERROR",
            "OPENAI_NETWORK_ERROR",
            "OPENAI_TIMEOUT",
          ].includes(mcpError.code);

          if (isRetryable && attempt < maxAttempts - 1) {
            const delayMs = baseDelay * Math.pow(2, attempt);
            const jitter = Math.floor(Math.random() * 201) - 100; // -100ms to +100ms
            const waitTime = Math.max(0, delayMs + jitter); // Ensure non-negative wait

            ctx.log.info(`Retrying after ${waitTime}ms delay...`);
            await delay(waitTime); // Wait before the next attempt
            continue; // Go to the next iteration of the loop
          } else {
            // Not retryable or last attempt failed
            const totalDuration = Date.now() - startTime;
            ctx.log.error(
              `Final attempt failed after ${totalDuration}ms: ${mcpError.message}`,
              {
                code: mcpError.code,
                details: mcpError.details,
                stack: error instanceof Error ? error.stack : undefined,
              }
            );

            // Create a standard Error and attach custom properties for the final throw
            const augmentedError = new Error(mcpError.message) as Error &
              Partial<McpError>;
            augmentedError.code = mcpError.code;
            augmentedError.details = mcpError.details;
            throw augmentedError; // Throw final augmented error
          }
        }
      } // End of retry loop

      // This point should ideally not be reached if maxAttempts > 0,
      // but is needed for TypeScript's control flow analysis.
      // Throw a generic internal error if the loop completes without success or throwing.
      throw new Error("OpenAI request failed after multiple retries.");
    }, // End of execute function
  }); // End of addTool

  // --- Start Server ---
  try {
    await server.start({
      transportType: "stdio", // Default, can be overridden by Cline config
      // If using HTTP/SSE:
      // transportType: "http",
      // http: { port: config.port } // Assuming port might be added to config later
    });
    // Use console.log for startup message as server.logger is not available
    console.log(
      `🚀 FileSearch MCP Server started successfully. Transport: stdio (default)`
    );
  } catch (error: unknown) {
    // Use unknown for safer error handling
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to start FastMCP server:", message);
    process.exit(1);
  }
}

// Run the main function
main().catch((error: unknown) => {
  // Use unknown for safer error handling
  const message = error instanceof Error ? error.message : String(error);
  console.error("Unhandled error in main function:", message);
  process.exit(1);
});

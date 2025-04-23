/**
 * Represents a single chunk of text retrieved from OpenAI File Search.
 */
export interface Chunk {
  /**
   * The unique identifier for this chunk (often related to the source file).
   * Note: The exact field name from OpenAI might differ (e.g., file_citation.file_id).
   * This needs verification against the actual API response.
   */
  id: string;

  /**
   * The actual text content of the chunk.
   */
  text: string;

  /**
   * The relevance score assigned by OpenAI File Search.
   */
  score: number;
}

/**
 * Represents the expected structure of the annotations array
 * within the OpenAI Responses API result for a file_search tool call.
 * This is an assumption based on documentation and needs verification.
 */
export interface OpenAiFileSearchAnnotation {
  type: "file_citation";
  text: string; // The text snippet matched
  start_index: number;
  end_index: number;
  file_citation: {
    file_id: string; // Used for Chunk.id
    // Potentially other fields like quote
  };
  // Assuming score is directly available or needs calculation/mapping
  // This part is uncertain. Let's assume a top-level score for now.
  // If score is per-annotation, this structure needs adjustment.
}

/**
 * Represents the expected structure of the content block containing annotations.
 */
export interface OpenAiContentBlock {
  type: "text";
  text: string; // The full response text potentially containing citations
  annotations: OpenAiFileSearchAnnotation[];
}

/**
 * Represents the expected structure of a single result item within the file_search_call.results array.
 */
export interface SearchResultItem {
  id?: string; // Optional ID for the result/chunk
  text?: string; // Text content
  score?: number; // Relevance score
  // Add other potential fields if known (e.g., metadata, file_id)
}

/**
 * Represents the expected structure of an item within the 'output' array
 * specifically for file search calls.
 */
export interface OutputItem {
  type: "file_search_call" | string; // Expect 'file_search_call', allow others
  results?: SearchResultItem[]; // Array of search results
  // Other potential fields depending on the 'type'
}

/**
 * Represents the expected structure of the relevant part of the OpenAI response.
 * Focusing on where the file search results are likely located.
 */
export interface OpenAiFileSearchResponse {
  // Assuming the relevant data is in an 'output' array
  output?: OutputItem[]; // Use the more specific OutputItem type
  // Potentially other top-level fields
}

// Configuration structure loaded from environment variables
export interface AppConfig {
  vectorStoreId: string;
  // port: number; // Port is no longer needed as we default to stdio
  openaiApiKey: string;
  debugOpenai: boolean; // Added flag to control verbose OpenAI response logging
}

/**
 * Represents a structured error object to be returned to the MCP client.
 */
export interface McpError {
  code:
    | "OPENAI_RATE_LIMIT"
    | "OPENAI_UPSTREAM_ERROR"
    | "OPENAI_NETWORK_ERROR"
    | "OPENAI_TIMEOUT"
    | "INTERNAL_SERVER_ERROR";
  message: string;
  details?: Record<string, string | number | boolean | null> | string; // Use basic serializable types
}

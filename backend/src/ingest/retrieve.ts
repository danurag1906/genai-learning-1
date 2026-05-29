import dotenv from "dotenv";

dotenv.config();

import { embeddings } from "./embed";
import { qdrant, COLLECTION_NAME } from "./qdrant";

export async function retrieveChunks(query: string) {
  try {
    // Step 1: Convert the user's text query into a vector embedding
    const vector = await embeddings.embedQuery(query);

    // Step 2: Search Qdrant for the top 5 most similar chunks
    const results = await qdrant.search(COLLECTION_NAME, {
      vector,
      limit: 5,
      with_payload: true, // We need the payload to get the text and metadata
    });

    // Step 3: Filter out results with low similarity scores
    const filteredResults = results.filter((result) => result.score >= 0.6);

    // Step 4: Deduplicate results to ensure we don't process the same text twice
    const uniqueResults = filteredResults.filter(
      (result, index, self) =>
        index ===
        self.findIndex((r) => r.payload?.text === result.payload?.text)
    );

    // Step 5: Format and return the retrieved chunks with their metadata
    return uniqueResults.map((result) => ({
      score: result.score,

      text: String(result.payload?.text || ""),

      source: result.payload?.source,

      fileName: result.payload?.fileName,

      pageNumber: result.payload?.pageNumber,

      chunkIndex: result.payload?.chunkIndex,
    }));
  } catch (error) {
    console.error("❌ Retrieval failed", error);

    throw error;
  }
}

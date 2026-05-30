import dotenv from "dotenv";

dotenv.config();

import { embeddings } from "./embed";
import { qdrant } from "./qdrant";

export async function retrieveChunks(
  query: string,
  collectionName: string,
  trace?: any
) {
  try {
    let embeddingGeneration;
    if (trace) {
      embeddingGeneration = trace.generation({
        name: "embed-query",
        model: "gemini-embedding-001",
        input: query,
      });
    }

    // Step 1: Convert the user's text query into a vector embedding
    const vector = await embeddings.embedQuery(query);

    if (embeddingGeneration) {
      embeddingGeneration.end({ output: "Vector generated successfully" });
    }

    // Step 2: Search Qdrant for the top 5 most similar chunks
    const results = await qdrant.search(collectionName, {
      vector,
      limit: 5,
      with_payload: true, // We need the payload to get the text and metadata
    });

    // Step 3: Filter out results with low similarity scores
    const filteredResults = results.filter((result) => result.score >= 0.6);

    // Step 5: Format and return the retrieved chunks with their metadata
    return filteredResults.map((result) => ({
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

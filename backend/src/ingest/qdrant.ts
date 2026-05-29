import { QdrantClient } from "@qdrant/js-client-rest";

// Initialize the Qdrant client for vector database operations
export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,

  apiKey: process.env.QDRANT_API_KEY,
});

// Name of the collection used to store the embedded chunks
export const COLLECTION_NAME = process.env.QDRANT_COLLECTION!;

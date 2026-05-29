import dotenv from "dotenv";
dotenv.config();
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

// Initialize the Google Gemini embedding model
// This model converts text into 3072-dimensional vectors
export const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY!,

  model: "gemini-embedding-001",
});

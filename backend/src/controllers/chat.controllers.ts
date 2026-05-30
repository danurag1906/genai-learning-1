import { Request, Response } from "express";

import { retrieveChunks } from "../ingest/retrieve";
import { formatRagResponse } from "../utils/ragFormatter";
import { langfuse } from "../config/langfuse";
import { routeQuery } from "../utils/queryRouter";

export const retrieveChat = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { query } = req.body;

    // Validate that a query was provided
    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Query is required",
      });
    }

    // Langfuse: Create a main trace for the entire chat request
    const trace = langfuse.trace({
      name: "catalog-chat",
      userId: "anonymous",
      input: {
        query,
      },
    });

    // Step 1: Retrieve relevant document chunks from Qdrant
    // Langfuse: Create a child span to monitor the retrieval step (latency and output)
    const retrievalSpan = trace.span({
      name: "retrieval",
    });

    // Classify the intent
    const category = await routeQuery(query, trace);
    const targetCollection =
      category === "stones"
        ? process.env.QDRANT_STONES_COLLECTION!
        : process.env.QDRANT_COLLECTION!;

    const chunks = await retrieveChunks(query, targetCollection, trace);

    // Langfuse: End the retrieval span and log the chunks retrieved and their scores
    retrievalSpan.end({
      output: {
        chunkCount: chunks.length,
        chunks: chunks.map((chunk: any) => ({
          pageNumber: chunk.pageNumber,
          score: chunk.score,
        })),
      },
    });

    // Langfuse: Create a child generation to monitor the Gemini LLM call
    const generation = trace.generation({
      name: "gemini-response",
      model: "gemini-2.5-flash",
    });

    // Step 2: Pass the chunks and query to the LLM to format the final answer
    const answer = await formatRagResponse(query, chunks, generation);

    // Langfuse: End the generation and log the final output from Gemini
    generation.end({
      output: answer,
    });

    // Step 3: Extract unique references (file name and page number) to send back
    const references = [
      ...new Map(
        chunks.map((chunk: any) => [
          `${chunk.fileName}-${chunk.pageNumber}`,
          {
            fileName: chunk.fileName,
            pageNumber: chunk.pageNumber,
          },
        ])
      ).values(),
    ];

    // Langfuse: Update the main trace with the overall success and result count
    trace.update({
      output: {
        success: true,
        resultCount: answer.items?.length || 0,
      },
    });

    // Langfuse: Flush the events to ensure they are sent to the server
    await langfuse.flushAsync();

    // Return the generated answer and the source references
    return res.json({
      success: true,
      answer,
      references,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

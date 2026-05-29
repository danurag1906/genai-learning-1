import { Request, Response } from "express";

import { retrieveChunks } from "../ingest/retrieve";
import { formatRagResponse } from "../utils/ragFormatter";

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

    // Step 1: Retrieve relevant document chunks from Qdrant
    const chunks = await retrieveChunks(query);

    // Step 2: Pass the chunks and query to the LLM to format the final answer
    const answer = await formatRagResponse(query, chunks);

    // Step 3: Extract unique references (file name and page number) to send back
    const references = [
      ...new Map(
        chunks.map((chunk) => [
          `${chunk.fileName}-${chunk.pageNumber}`,
          {
            fileName: chunk.fileName,
            pageNumber: chunk.pageNumber,
          },
        ])
      ).values(),
    ];

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

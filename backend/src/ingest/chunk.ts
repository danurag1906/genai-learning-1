import { Document } from "@langchain/core/documents";

import {
  RecursiveCharacterTextSplitter,
  MarkdownTextSplitter,
} from "@langchain/textsplitters";

/**
 * Structure-aware chunking
 * for catalog markdown.
 */
export async function chunkMarkdown(markdown: string) {
  /**
   * STEP 1
   * Split markdown intelligently
   */
  const markdownSplitter = new MarkdownTextSplitter({
    chunkSize: 2500,

    chunkOverlap: 400,
  });

  const markdownDocs = await markdownSplitter.createDocuments([markdown]);

  /**
   * STEP 2
   * Further semantic splitting
   */
  const recursiveSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1500,

    chunkOverlap: 300,

    separators: ["\n## ", "\n### ", "\n#### ", "\n\n", "\n", " "],
  });

  const finalChunks = await recursiveSplitter.splitDocuments(markdownDocs);

  /**
   * STEP 3
   * Remove tiny/useless chunks
   */
  return finalChunks.filter((chunk) => chunk.pageContent.trim().length > 150);
}

/**
 * Extract approximate page number
 */
export function extractPageNumber(content: string) {
  const regex = /page[:\s]+(\d+)/i;

  const match = content.match(regex);

  if (match?.[1]) {
    return Number(match[1]);
  }

  return 1;
}

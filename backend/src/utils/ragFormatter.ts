import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";

// Initialize the Gemini 2.5 Flash model
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0, // Set to 0 for deterministic, factual responses
});

// Define the expected JSON schema for the LLM output using Zod
const responseSchema = z.object({
  summary: z.string().describe("Short summary answering the user's query"),
  items: z.array(
    z.object({
      name: z.string().describe("Main name or title of the extracted item"),
      details: z.string().describe("Detailed description or key information"),
      metadata: z
        .array(z.object({ key: z.string(), value: z.string() }))
        .describe(
          "Any other relevant extracted fields like dates, IDs, values, quantities, etc. in key-value pairs"
        ),
      pageNumber: z.number().describe("Page number of the source document"),
    })
  ),
});

// Bind the schema to the LLM to force structured JSON output
const structuredLlm = llm.withStructuredOutput(responseSchema, { includeRaw: true });

export async function formatRagResponse(query: string, chunks: any[], generation?: any) {
  // If no context was found, return an empty response
  if (!chunks.length) {
    return {
      summary:
        "I could not find relevant information in the retrieved documents.",
      items: [],
    };
  }

  // Format the retrieved chunks into a single text block for the LLM prompt
  const context = chunks
    .map(
      (chunk, index) => `
SOURCE ${index + 1}

FILE: ${chunk.fileName}
PAGE: ${chunk.pageNumber}

CONTENT:
${chunk.text}
`
    )
    .join("\n\n");

  // Construct the prompt with strict rules to prevent hallucination
  const prompt = `
You are a document information extraction assistant.

USER QUERY:
${query}

RETRIEVED CONTEXT:
${context}

STRICT RULES:

1. ONLY use information from the retrieved context.
2. NEVER invent information.
3. NEVER modify original data (e.g., dates, IDs, values, quantities, numbers, price).
4. Extract only information relevant to the user's query.
5. Remove duplicate items.
6. Extract a maximum of 5 of the most relevant items. Do not list more than 5.
7. If no items are found return an empty array for items.
`;

  // Langfuse: Log the constructed prompt (with context) as the input to the generation
  if (generation) {
    generation.update({
      input: prompt,
    });
  }

  try {
    // Generate the structured response using the prompt
    const response: any = await structuredLlm.invoke(prompt);
    const parsedData = response.parsed;
    const usage = response.raw?.usage_metadata;

    // Langfuse: Log the actual token usage reported by Gemini
    if (generation && usage) {
      generation.update({
        usage: {
          input: usage.input_tokens,
          output: usage.output_tokens,
          unit: "TOKENS",
        },
      });
    }
    
    // Transform the metadata array back into a readable key-value object for the frontend
    const formattedResponse = {
      ...parsedData,
      items: parsedData.items.map((item: any) => ({
        ...item,
        metadata: item.metadata.reduce((acc: any, curr: any) => {
          acc[curr.key] = curr.value;
          return acc;
        }, {} as Record<string, string>),
      })),
    };

    return formattedResponse;
  } catch (error) {
    console.error("Failed to format Gemini response", error);

    return {
      summary: "Unable to format retrieved information.",
      items: [],
    };
  }
}

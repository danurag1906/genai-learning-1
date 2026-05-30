import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0,
});

// Force Gemini to pick one of the available collections
const routingSchema = z.object({
  category: z.enum(["stones", "generic"]).describe("The category of the user query"),
});

const routerLlm = llm.withStructuredOutput(routingSchema, { includeRaw: true });

export async function routeQuery(query: string, trace?: any) {
  const prompt = `
  You are an intelligent router for a product catalog.
  Classify the user's query into the correct category.
  
  - If the query asks about stones, marble, granite, or rock textures, output "stones".
  - If the query asks about anything else (basins, faucets, toilets), output "generic".
  
  USER QUERY: ${query}
  `;

  // Langfuse: Create a child generation to monitor the Intent Routing LLM call
  let generation: any;
  if (trace) {
    generation = trace.generation({
      name: "intent-router",
      model: "gemini-2.5-flash",
      input: prompt,
    });
  }

  try {
    const response: any = await routerLlm.invoke(prompt);
    
    if (generation) {
      const usage = response.raw?.usage_metadata;
      if (usage) {
        generation.update({
          usage: {
            input: usage.input_tokens,
            output: usage.output_tokens,
            unit: "TOKENS",
          },
        });
      }
      generation.end({ output: response.parsed.category });
    }
    
    return response.parsed.category;
  } catch (error) {
    if (generation) {
      generation.end({ output: "generic (fallback)", level: "ERROR" });
    }
    return "generic"; // Fallback to generic if routing fails
  }
}

import dotenv from "dotenv";
import path from "path";
dotenv.config();

import { glob } from "glob";

import { v4 as uuidv4 } from "uuid";

import { parsePdf, saveMarkdown } from "./parse";

import { chunkMarkdown, extractPageNumber } from "./chunk";

import { embeddings } from "./embed";

import { qdrant } from "./qdrant";

async function createCollection(collectionName: string) {
  try {
    /**
     * Delete old collection first
     */
    await qdrant.deleteCollection(collectionName);

    console.log(`🗑️ Old collection deleted: ${collectionName}`);
  } catch (error) {
    console.log("ℹ️ No old collection found");
  }

  /**
   * Create fresh collection
   * with correct Gemini dimensions
   */
  await qdrant.createCollection(collectionName, {
    vectors: {
      size: 3072,

      distance: "Cosine",
    },
  });

  console.log(`✅ Qdrant collection created: ${collectionName}`);
}

async function ingestCatalogs() {
  try {
    const genericCol = process.env.QDRANT_COLLECTION!;
    const stonesCol = process.env.QDRANT_STONES_COLLECTION!;

    await createCollection(genericCol);
    await createCollection(stonesCol);

    const pdfFiles = await glob(path.join(process.cwd(), "src/catalog/*.pdf"));

    console.log(`📚 Found ${pdfFiles.length} PDF files`);

    for (const pdfFile of pdfFiles) {
      console.log(`\n📄 Processing: ${pdfFile}`);
      
      const isStone = pdfFile.toLowerCase().includes("stone");
      const targetCollection = isStone ? stonesCol : genericCol;
      console.log(`🎯 Targeting collection: ${targetCollection}`);

      // STEP 1
      // Parse PDF using LlamaParse for high-quality markdown extraction
      const markdown = await parsePdf(pdfFile);

      // Add this check:
      if (!markdown) {
        console.warn(`⚠️ No markdown extracted for ${pdfFile}`);
        continue;
      }

      // STEP 2
      // Save parsed markdown
      await saveMarkdown(pdfFile, markdown);

      // STEP 3
      // Semantic chunking
      const chunks = await chunkMarkdown(markdown);

      console.log(`✂️ Created ${chunks.length} chunks`);

      // STEP 4
      // Generate embeddings + store
      for (let index = 0; index < chunks.length; index++) {
        const chunk = chunks[index];

        const vector = await embeddings.embedQuery(chunk.pageContent);

        // Extract page number
        const pageNumber = extractPageNumber(chunk.pageContent);

        await qdrant.upsert(targetCollection, {
          wait: false,

          points: [
            {
              id: uuidv4(),

              vector,

              payload: {
                text: chunk.pageContent,

                source: path.basename(pdfFile),

                fileName: path.basename(pdfFile),

                pageNumber,

                chunkIndex: index,

                chunkLength: chunk.pageContent.length,

                contentType: "catalog",

                ingestedAt: new Date().toISOString(),
              },
            },
          ],
        });
      }

      console.log(`✅ Finished ingesting ${path.basename(pdfFile)}`);
    }

    console.log("\n🎉 All catalogs ingested successfully");
  } catch (error) {
    console.error("❌ Ingestion failed", error);
  }
}

ingestCatalogs();

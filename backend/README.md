# GenAI RAG Pipeline Backend

This repository contains a robust Retrieval-Augmented Generation (RAG) backend API built with Node.js, Express, and TypeScript. It is designed to ingest PDF catalogs, extract and structure their contents, and provide highly relevant, context-aware answers to user queries using state-of-the-art LLMs and vector databases.

## Features

- **Automated PDF Ingestion**: Process multiple PDF files (catalogs) sequentially.
- **Intelligent Parsing**: Utilizes LlamaParse to accurately convert PDF layouts (including tables, headings, and lists) into clean Markdown.
- **Structure-Aware Chunking**: Uses LangChain to split documents into semantic chunks, avoiding disjointed sentences or broken paragraphs.
- **Vector Embeddings**: Uses Google's `gemini-embedding-001` model to create high-quality vector representations (3072 dimensions) of the document chunks.
- **Vector Storage**: Integrates with Qdrant for fast and scalable similarity search.
- **RAG Retrieval API**: A dedicated endpoint (`/api/chat/query`) that takes user questions, performs similarity search, filters relevant results, and generates structured answers using Gemini 2.5 Flash.
- **Structured LLM Responses**: Forces the LLM to output structured JSON data (summary and relevant products list) using Zod schemas.

## Tech Stack

- **Framework**: Node.js, Express, TypeScript
- **Parsing**: LlamaParse (LlamaIndex Cloud API)
- **Chunking/Orchestration**: LangChain (`@langchain/textsplitters`, `@langchain/core`)
- **Embeddings & LLM**: Google Gemini (`gemini-embedding-001`, `gemini-2.5-flash`)
- **Vector Database**: Qdrant (`@qdrant/js-client-rest`)
- **Validation**: Zod (for structured LLM outputs)

## Pipeline Overview

1. **Ingestion & Parsing (`src/ingest/ingest.ts`, `src/ingest/parse.ts`)**
   - Reads PDFs from the `src/catalog` directory.
   - Uploads them to LlamaParse to accurately extract text as Markdown, preserving structural integrity.
   - Saves the raw Markdown files to `src/parsed` for caching/debugging.

2. **Chunking (`src/ingest/chunk.ts`)**
   - The Markdown text is processed using `MarkdownTextSplitter` and `RecursiveCharacterTextSplitter`.
   - Ensures chunks are logically grouped (e.g., by headers) and keeps overlaps to preserve context.

3. **Embedding & Storage (`src/ingest/embed.ts`, `src/ingest/qdrant.ts`)**
   - The text chunks are passed to the Gemini Embedding model.
   - The resulting vectors, along with metadata (source file, page number, original text), are stored in a Qdrant collection.

4. **Query Retrieval (`src/ingest/retrieve.ts`, `src/controllers/chat.controllers.ts`)**
   - The user's text query is converted into a vector.
   - Qdrant is queried to find the top matching chunks using Cosine similarity.
   - Results are filtered by a confidence score threshold and deduplicated.

5. **Generation (`src/utils/ragFormatter.ts`)**
   - The retrieved context is formatted and fed into the Gemini 2.5 Flash model alongside the user query.
   - The LLM strictly follows predefined rules to extract product information without hallucinating, returning a typed JSON response.

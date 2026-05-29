import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";

const API_KEY = process.env.LLAMA_CLOUD_API_KEY!;

const BASE_URL = "https://api.cloud.llamaindex.ai/api/parsing";

export async function parsePdf(filePath: string) {
  try {
    const fileName = path.basename(filePath);

    console.log(`⏳ Uploading ${fileName} to LlamaParse...`);

    /**
     * STEP 1
     * Upload the PDF file to LlamaParse and request markdown output
     */
    const formData = new FormData();

    formData.append("file", fs.createReadStream(filePath));

    formData.append("result_type", "markdown");

    formData.append(
      "parsing_instruction",
      `
      This is a structured document PDF.

      Preserve:
      - headings
      - tables
      - key-value pairs
      - lists
      - section hierarchy

      Return clean markdown.
      `
    );

    const uploadResponse = await axios.post(`${BASE_URL}/upload`, formData, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        ...formData.getHeaders(),
      },

      maxBodyLength: Infinity,
    });

    const jobId = uploadResponse.data.id;

    console.log(`✅ Parsing job created: ${jobId}`);

    /**
     * STEP 2
     * Poll parsing job
     */
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const statusResponse = await axios.get(`${BASE_URL}/job/${jobId}`, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      });

      const status = statusResponse.data.status;

      console.log(`📄 Parsing status: ${status}`);

      if (status === "SUCCESS") {
        break;
      }

      if (status === "ERROR" || status === "FAILED") {
        throw new Error("Parsing failed");
      }
    }

    /**
     * STEP 3
     * Get markdown result
     */
    const markdownResponse = await axios.get(
      `${BASE_URL}/job/${jobId}/result/markdown`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      }
    );

    console.log(`✅ Successfully parsed ${fileName}`);

    return markdownResponse.data.markdown;
  } catch (error) {
    console.error("❌ Parsing failed", error);

    throw error;
  }
}

export async function saveMarkdown(pdfPath: string, markdown: string) {
  const fileName = path.basename(pdfPath, ".pdf");

  const outputDir = path.join(process.cwd(), "src/parsed");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, {
      recursive: true,
    });
  }

  const outputPath = path.join(outputDir, `${fileName}.md`);

  fs.writeFileSync(outputPath, markdown);

  console.log(`✅ Saved markdown: ${outputPath}`);
}

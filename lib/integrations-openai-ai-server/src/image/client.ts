import fs from "node:fs";
import { Buffer } from "node:buffer";
import { toFile } from "openai";
import {
  getOpenAIClient,
  openai,
  readImageBase64,
  withOpenAIErrorHandling,
} from "../client";

export { openai };

type GenerateImageClient = {
  images: {
    generate(params: unknown): Promise<unknown>;
  };
};

type EditImageClient = {
  images: {
    edit(params: unknown): Promise<unknown>;
  };
};

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "512x512" | "256x256" = "1024x1024",
  client: GenerateImageClient = getOpenAIClient() as unknown as GenerateImageClient,
): Promise<Buffer> {
  return withOpenAIErrorHandling("OpenAI image generation", async () => {
    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size,
    });
    return Buffer.from(
      readImageBase64(response, "OpenAI image generation"),
      "base64",
    );
  });
}

export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string,
  client: EditImageClient = getOpenAIClient() as unknown as EditImageClient,
): Promise<Buffer> {
  return withOpenAIErrorHandling("OpenAI image edit", async () => {
    const images = await Promise.all(
      imageFiles.map((file) =>
        toFile(fs.createReadStream(file), file, {
          type: "image/png",
        }),
      ),
    );

    const response = await client.images.edit({
      model: "gpt-image-1",
      image: images,
      prompt,
    });

    const imageBytes = Buffer.from(
      readImageBase64(response, "OpenAI image edit"),
      "base64",
    );

    if (outputPath) {
      fs.writeFileSync(outputPath, imageBytes);
    }

    return imageBytes;
  });
}

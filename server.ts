import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  // Initialize Gemini AI
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      hasApiKey: !!process.env.GEMINI_API_KEY 
    });
  });

  // API Routes
  app.post("/api/tts", async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured in the environment");
      }

      const { text, voiceName = "Kore" } = req.body;

      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      console.log(`Generating TTS for: "${text.substring(0, 50)}..." with voice: ${voiceName}`);

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
          ],
        },
      });

      if (!response.candidates || response.candidates.length === 0) {
        console.error("Gemini API No Candidates. Response:", JSON.stringify(response, null, 2));
        throw new Error("Gemini API blocked the response or failed to generate audio. This might be due to safety filters.");
      }

      const candidate = response.candidates[0];
      const base64Audio = candidate.content?.parts?.[0]?.inlineData?.data;

      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        console.log("Finish reason:", candidate.finishReason);
      }

      if (!base64Audio) {
        console.error("No audio data in response part:", candidate.content?.parts?.[0]);
        throw new Error("Failed to generate audio from Gemini API: Missing audio data in response");
      }

      res.json({ audio: base64Audio });
    } catch (error: any) {
      console.error("TTS API Error Details:", {
        message: error.message,
        stack: error.stack,
        details: error.details || error.response?.data || error.response
      });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

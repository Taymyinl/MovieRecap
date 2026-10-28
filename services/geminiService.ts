import { TranscriptResult } from "../types";

export interface ModelInfo {
  model: string;
  modelName: string;
  status: string;
  description: string;
}

export const generateTranscript = async (
  fileBase64: string,
  mimeType: string,
  targetLanguage: string
): Promise<TranscriptResult> => {
  const response = await fetch("/api/transcript", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileBase64,
      mimeType,
      targetLanguage,
    }),
  });

  if (!response.ok) {
    let errorMessage = "Failed to process video with Gemini AI";
    if (response.status === 413) {
      throw new Error(
        "Server Error 413 (Payload Too Large): The media file or extracted audio exceeded the 32MB cloud hosting limit. Please trim your video to under 15 minutes or compress it before uploading."
      );
    }

    try {
      const data = await response.json();
      if (data?.error) {
        errorMessage = data.error;
      }
    } catch {
      errorMessage = `Server error (${response.status}): ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  const result: TranscriptResult = await response.json();
  return result;
};

export const fetchModelInfo = async (): Promise<ModelInfo> => {
  try {
    const res = await fetch("/api/model-info");
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Could not retrieve model info from server:", err);
  }

  return {
    model: "gemini-3.8-flash",
    modelName: "Gemini 3.8 Flash",
    status: "active",
    description: "Gemini 3.8 Flash multimodal transcription and translation.",
  };
};
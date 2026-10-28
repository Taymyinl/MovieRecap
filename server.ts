import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Increase JSON body limit to support base64 video and audio payloads
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Server-side initialization of Gemini client with recommended telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Model info endpoint to communicate active Gemini model version to the client
app.get('/api/model-info', (_req, res) => {
  res.json({
    model: 'gemini-3.8-flash',
    modelName: 'Gemini 3.8 Flash',
    status: process.env.GEMINI_API_KEY ? 'active' : 'missing_api_key',
    description: 'Latest Google Gemini multimodal model optimized for audio transcription, precise timestamps, and natural translation.',
  });
});

// API endpoint for transcribing and translating video/audio
app.post('/api/transcript', async (req, res) => {
  try {
    const { fileBase64, mimeType, targetLanguage } = req.body;

    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: 'Missing fileBase64 or mimeType in request payload.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured in the server environment. Please ensure the API key is attached in Settings > Secrets.',
      });
    }

    const language = targetLanguage || 'Burmese';

    const prompt = `You are an expert subtitle transcriber and movie recap translator.
Analyze the speech and narration in this audio carefully.
1. Transcribe the spoken narration or dialogue verbatim in its original spoken language.
2. Break the narration into logical, cohesive sentences or storytelling phrases.
3. For each segment, provide the **precise** start and end timestamps in "MM:SS" format (relative to this segment). Timestamps must be sequential and synchronize accurately with the speech.
4. Translate each segment into ${language}.
${
  language.toLowerCase().includes('burmese') || language.toLowerCase().includes('myanmar')
    ? 'For Burmese translation: Use engaging, cinematic Burmese Unicode (မြန်မာဘာသာ). Translate in natural movie recap storytelling style (ရုပ်ရှင်ဇာတ်လမ်းပြော စတိုင်လ် အဆင်ပြေပြေနှင့် သဘာဝကျသော ဘာသာပြန်) with correct grammar, dramatic flow, and clear dialogue.'
    : `Ensure fluent, high-quality translation suitable for movie recaps and dialogue in ${language}.`
}

If there is no speech in this audio segment, return an empty segments array.
Format the output strictly as a JSON object adhering to the schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: fileBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            originalLanguage: {
              type: Type.STRING,
              description: 'The detected original language of the media audio (e.g., English, Japanese, Burmese).',
            },
            translatedLanguage: {
              type: Type.STRING,
              description: `The target translation language (${language}).`,
            },
            segments: {
              type: Type.ARRAY,
              description: 'List of transcript segments with timestamps.',
              items: {
                type: Type.OBJECT,
                properties: {
                  startTime: {
                    type: Type.STRING,
                    description: 'Start time in MM:SS format, e.g. 00:05',
                  },
                  endTime: {
                    type: Type.STRING,
                    description: 'End time in MM:SS format, e.g. 00:12',
                  },
                  originalText: {
                    type: Type.STRING,
                    description: 'The original spoken transcript for this segment',
                  },
                  translatedText: {
                    type: Type.STRING,
                    description: `The translation of this segment in ${language}`,
                  },
                },
                required: ['startTime', 'endTime', 'originalText', 'translatedText'],
              },
            },
          },
          required: ['originalLanguage', 'translatedLanguage', 'segments'],
        },
      },
    });

    const rawText = response.text;
    if (!rawText) {
      return res.status(500).json({ error: 'No output was generated from the Gemini model.' });
    }

    // Safely remove markdown code fences if generated
    const cleanedText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const result = JSON.parse(cleanedText);

    return res.json(result);
  } catch (error: any) {
    console.error('Gemini Server Error:', error);
    const message = error?.message || 'An unexpected error occurred while processing the video with Gemini.';
    return res.status(500).json({ error: message });
  }
});

// Serve frontend: Vite middlewares in development, static files in production
if (process.env.NODE_ENV !== 'production') {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TubeScribe full-stack server running on http://0.0.0.0:${PORT}`);
});

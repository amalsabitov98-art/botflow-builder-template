export interface AudioTranscriptionOptions {
  geminiApiKey?: string;
  groqApiKey?: string;
  openaiApiKey?: string;
  xaiApiKey?: string;
}

// Провайдер распознавания речи: имя для логов, ключ и как его позвать.
// Порядок в списке — это и есть приоритет: сначала самые точные и быстрые,
// дальше — то, что есть под рукой. Первый непустой ответ выигрывает.
interface TranscriptionProvider {
  name: string;
  apiKey?: string;
  run: (buffer: Buffer, mimeType: string, apiKey: string) => Promise<string | null>;
}

/**
 * Транскрибирует голосовое сообщение Telegram (OGG Opus) в текст.
 *
 * Ключи приходят только аргументом: читать process.env здесь нельзя, иначе
 * распознавание пойдёт мимо config.ts, который в development не отдаёт боевые
 * ключи без ALLOW_LIVE_SERVICES_IN_DEV.
 *
 * Возвращает расшифровку или null, если ни один провайдер не настроен и не смог.
 */
export async function transcribeVoiceNote(
  audioBuffer: Buffer,
  mimeType: string = "audio/ogg",
  options: AudioTranscriptionOptions = {},
): Promise<string | null> {
  const providers: TranscriptionProvider[] = [
    // xAI STT (Grok): самое точное на русском из доступного.
    { name: "xAI STT", apiKey: options.xaiApiKey, run: transcribeWithXAI },
    // Groq Whisper: субсекундный инференс на LPU.
    {
      name: "Groq Whisper",
      apiKey: options.groqApiKey,
      run: (buffer, _mimeType, apiKey) => transcribeWithWhisper(
        buffer,
        "https://api.groq.com/openai/v1/audio/transcriptions",
        apiKey,
        "whisper-large-v3",
      ),
    },
    // Gemini: мультимодальный, ключ у проекта обычно уже есть.
    { name: "Gemini Audio", apiKey: options.geminiApiKey, run: transcribeWithGemini },
    // OpenAI Whisper: последний рубеж.
    {
      name: "OpenAI Whisper",
      apiKey: options.openaiApiKey,
      run: (buffer, _mimeType, apiKey) => transcribeWithWhisper(
        buffer,
        "https://api.openai.com/v1/audio/transcriptions",
        apiKey,
        "whisper-1",
      ),
    },
  ];

  for (const provider of providers) {
    const apiKey = provider.apiKey?.trim();
    if (!apiKey) continue;
    try {
      const text = await provider.run(audioBuffer, mimeType, apiKey);
      if (text) return text;
    } catch (error) {
      console.warn(`[TRANSCRIPTION] ${provider.name} failed, trying fallback:`, error);
    }
  }

  return null;
}

async function transcribeWithGemini(buffer: Buffer, mimeType: string, apiKey: string): Promise<string | null> {
  // Имя модели меняется чаще, чем формат запроса: перебираем от свежих к старым,
  // чтобы устаревшее имя в начале списка не лишало проект распознавания вовсе.
  const candidateModels = [
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ];

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType || "audio/ogg",
                    data: buffer.toString("base64"),
                  },
                },
                {
                  text: "Транскрибируй это аудиосообщение на русском языке в точный текст. Верни только расшифрованный текст без кавычек, пояснений и метаданных.",
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
          },
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (candidateText) return candidateText;
      }
    } catch {
      // Пробуем следующую модель
    }
  }

  return null;
}

async function transcribeWithWhisper(
  buffer: Buffer,
  endpoint: string,
  apiKey: string,
  model: string,
): Promise<string | null> {
  const formData = new FormData();
  const blob = new Blob([buffer], { type: "audio/ogg" });
  formData.append("file", blob, "voice.oga");
  formData.append("model", model);
  formData.append("language", "ru");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Whisper API error (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = await response.json() as any;
  return data?.text?.trim() || null;
}

async function transcribeWithXAI(buffer: Buffer, _mimeType: string, apiKey: string): Promise<string | null> {
  const formData = new FormData();
  const blob = new Blob([buffer], { type: "audio/ogg" });
  formData.append("file", blob, "voice.ogg");
  formData.append("language", "ru");

  const response = await fetch("https://api.x.ai/v1/stt", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`xAI STT API error (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as any;
  return data?.text?.trim() || null;
}

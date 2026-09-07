import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transcribeVoiceNote } from "../services/audioTranscription";

const audio = Buffer.from("fake-ogg");

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe("Распознавание голосовых сообщений", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("без ключей не ходит в сеть и возвращает null", async () => {
    expect(await transcribeVoiceNote(audio, "audio/ogg", {})).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ключи берёт только из аргументов, а не из переменных окружения", async () => {
    // Иначе распознавание пошло бы мимо config.ts, который в development
    // не отдаёт боевые ключи без ALLOW_LIVE_SERVICES_IN_DEV.
    vi.stubEnv("XAI_API_KEY", "env-xai-key");
    vi.stubEnv("GROQ_API_KEY", "env-groq-key");
    vi.stubEnv("OPENAI_API_KEY", "env-openai-key");

    expect(await transcribeVoiceNote(audio, "audio/ogg", {})).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("отдаёт расшифровку первого сработавшего провайдера", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ text: "привет из xAI" }));

    const result = await transcribeVoiceNote(audio, "audio/ogg", {
      xaiApiKey: "xai-key",
      groqApiKey: "groq-key",
    });

    expect(result).toBe("привет из xAI");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.x.ai");
  });

  it("переходит к следующему провайдеру, когда предыдущий упал", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "quota" }, false, 429))
      .mockResolvedValueOnce(jsonResponse({ text: "привет из Groq" }));

    const result = await transcribeVoiceNote(audio, "audio/ogg", {
      xaiApiKey: "xai-key",
      groqApiKey: "groq-key",
    });

    expect(result).toBe("привет из Groq");
    expect(String(fetchMock.mock.calls[1][0])).toContain("api.groq.com");
  });

  it("возвращает null, когда не смог ни один провайдер", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "nope" }, false, 500));

    const result = await transcribeVoiceNote(audio, "audio/ogg", {
      xaiApiKey: "xai-key",
      openaiApiKey: "openai-key",
    });

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("пропускает провайдера с пустым ключом", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ text: "привет из Whisper" }));

    const result = await transcribeVoiceNote(audio, "audio/ogg", {
      xaiApiKey: "   ",
      openaiApiKey: "openai-key",
    });

    expect(result).toBe("привет из Whisper");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.openai.com");
  });
});

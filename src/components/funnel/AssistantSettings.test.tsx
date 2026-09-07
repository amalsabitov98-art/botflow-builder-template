// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AssistantSettings from "./AssistantSettings";
import type { FunnelAssistant } from "../../types/funnel";

beforeEach(() => {
  // Панель спрашивает у сервера, задан ли ключ ассистента.
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({ assistantConfigured: true }),
  })) as any);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AssistantSettings", () => {
  it("прячет настройки, пока ассистент выключен", () => {
    render(<AssistantSettings onChange={() => undefined} />);

    expect(screen.getByRole("button", { name: "Включить" })).toBeInTheDocument();
    expect(screen.queryByText("Что ассистенту разрешено")).not.toBeInTheDocument();
  });

  it("включает ассистента выключенным по действиям", () => {
    const onChange = vi.fn();
    render(<AssistantSettings onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Включить" }));

    expect(onChange).toHaveBeenCalledWith({ enabled: true });
    const next: FunnelAssistant = onChange.mock.calls[0][0];
    expect(next.allowResendStage).toBeUndefined();
    expect(next.allowPaymentLink).toBeUndefined();
  });

  it("показывает действия и границы, когда ассистент включён", () => {
    render(<AssistantSettings assistant={{ enabled: true }} onChange={() => undefined} />);

    expect(screen.getByText("Передавать разговор человеку")).toBeInTheDocument();
    expect(screen.getByText("Повторно отправлять этап")).toBeInTheDocument();
    expect(screen.getByText(/Ссылку и цену подставляет сервер/)).toBeInTheDocument();
  });

  it("переключает разрешение на повторную отправку этапа", () => {
    const onChange = vi.fn();
    render(<AssistantSettings assistant={{ enabled: true }} onChange={onChange} />);

    fireEvent.click(screen.getByText("Повторно отправлять этап"));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, allowResendStage: true }));
  });

  it("предлагает персонализацию дожима, выключенную по умолчанию", () => {
    const onChange = vi.fn();
    render(<AssistantSettings assistant={{ enabled: true }} onChange={onChange} />);

    expect(screen.getByText("Персонализирует напоминания")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Персонализирует напоминания"));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ personalizeReminders: true }));
  });

  it("прячет разрешения переписки, когда ответы на сообщения выключены", () => {
    render(
      <AssistantSettings
        assistant={{ enabled: true, replyToMessages: false, personalizeReminders: true }}
        onChange={() => undefined}
      />,
    );

    // Дожим настраивается, а инструменты диалога больше не показываются.
    expect(screen.getByText("Персонализирует напоминания")).toBeInTheDocument();
    expect(screen.queryByText("Передавать разговор человеку")).not.toBeInTheDocument();
    expect(screen.queryByText("Повторно отправлять этап")).not.toBeInTheDocument();
  });

  it("предупреждает, что без ключа ассистент отвечать не будет", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ assistantConfigured: false }),
    })) as any);

    render(<AssistantSettings assistant={{ enabled: true }} onChange={() => undefined} />);

    expect(await screen.findByText(/Ключ DeepSeek не задан/)).toBeInTheDocument();
  });
});

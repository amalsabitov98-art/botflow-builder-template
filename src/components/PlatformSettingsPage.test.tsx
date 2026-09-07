// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlatformSettingsPage from "./PlatformSettingsPage";
import { DEFAULT_LESSONS } from "./platform/defaultProgram";

const funnels = [
  { id: "funnel-a", title: "Воронка А", platform: { curatorUrl: "https://t.me/a" } },
  { id: "funnel-b", title: "Воронка Б" },
];

const openTab = (label: string) => fireEvent.click(screen.getByRole("button", { name: label }));

afterEach(() => {
  cleanup();
});

describe("PlatformSettingsPage", () => {
  it("открывается на программе платформы", () => {
    render(<PlatformSettingsPage funnels={funnels} selectedFunnelId="funnel-a" />);

    expect(screen.getByText("Программа платформы")).toBeInTheDocument();
    expect(screen.getByText(/ученик увидит встроенный курс/)).toBeInTheDocument();
  });

  it("показывает эфиры и чат куратора выбранной воронки", () => {
    render(<PlatformSettingsPage funnels={funnels} selectedFunnelId="funnel-a" />);
    openTab("Эфиры и куратор");

    expect(screen.getByPlaceholderText("https://t.me/ваш_чат")).toHaveValue("https://t.me/a");
    expect(screen.getByText("Эфиры платформы")).toBeInTheDocument();
  });

  it("сохраняет правку в ту воронку, что выбрана сверху", () => {
    const onUpdateFunnel = vi.fn();
    render(
      <PlatformSettingsPage
        funnels={funnels}
        selectedFunnelId="funnel-b"
        onUpdateFunnel={onUpdateFunnel}
      />,
    );
    openTab("Эфиры и куратор");

    fireEvent.change(screen.getByPlaceholderText("https://t.me/ваш_чат"), {
      target: { value: "https://t.me/b" },
    });

    expect(onUpdateFunnel).toHaveBeenCalledWith(
      expect.objectContaining({ id: "funnel-b", platform: { curatorUrl: "https://t.me/b" } }),
    );
  });

  it("копирует встроенный курс в программу воронки", () => {
    const onUpdateFunnel = vi.fn();
    render(
      <PlatformSettingsPage
        funnels={funnels}
        selectedFunnelId="funnel-b"
        onUpdateFunnel={onUpdateFunnel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Взять встроенный курс за основу" }));

    const updated = onUpdateFunnel.mock.calls[0][0];
    expect(updated.id).toBe("funnel-b");
    expect(updated.platform.lessons).toHaveLength(DEFAULT_LESSONS.length);
    expect(updated.platform.lessons[0].title).toBe(DEFAULT_LESSONS[0].title);
  });

  it("без воронок предлагает сначала создать её", () => {
    render(<PlatformSettingsPage funnels={[]} />);

    expect(screen.getByText("Пока нет воронок")).toBeInTheDocument();
    expect(screen.queryByText("Программа платформы")).not.toBeInTheDocument();
  });
});

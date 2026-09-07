// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GalleryPage from "./GalleryPage";

function mediaItem(id: string, name: string, usedIn: Array<{ id: string; title: string; type?: string }>) {
  return {
    id,
    filename: `${name}.png`,
    name,
    url: `/media/${name}.png`,
    type: "image",
    mimeType: "image/png",
    size: 1024,
    createdAt: "2026-08-27T10:00:00.000Z",
    source: "upload",
    usedIn,
  };
}

const items = [
  mediaItem("m1", "обложка-лида", [{ id: "f1", title: "Мини-курс", type: "lead" }]),
  mediaItem("m2", "видео-услуги", [{ id: "f2", title: "Консультация", type: "sales" }]),
  mediaItem("m3", "ничей-файл", []),
];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({ items }),
  })) as any);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function renderGallery() {
  render(<GalleryPage />);
  await waitFor(() => expect(screen.getByText("обложка-лида")).toBeInTheDocument());
}

describe("GalleryPage: отбор по воронке", () => {
  it("предлагает и конкретные воронки, и виды оффера", async () => {
    await renderGallery();

    fireEvent.click(screen.getByLabelText("Воронка"));

    expect(screen.getByRole("option", { name: /Вид: Лид-магнит/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Вид: Продажа услуги/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Мини-курс/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Нигде не используются/ })).toBeInTheDocument();
  });

  it("оставляет файлы воронок выбранного вида", async () => {
    await renderGallery();

    fireEvent.click(screen.getByLabelText("Воронка"));
    fireEvent.click(screen.getByRole("option", { name: /Вид: Лид-магнит/ }));

    await waitFor(() => expect(screen.queryByText("видео-услуги")).not.toBeInTheDocument());
    expect(screen.getByText("обложка-лида")).toBeInTheDocument();
    expect(screen.queryByText("ничей-файл")).not.toBeInTheDocument();
  });

  it("отбор по конкретной воронке продолжает работать", async () => {
    await renderGallery();

    fireEvent.click(screen.getByLabelText("Воронка"));
    fireEvent.click(screen.getByRole("option", { name: /Консультация/ }));

    await waitFor(() => expect(screen.queryByText("обложка-лида")).not.toBeInTheDocument());
    expect(screen.getByText("видео-услуги")).toBeInTheDocument();
  });
});

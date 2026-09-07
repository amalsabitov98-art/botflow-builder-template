// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomStage3 from "./CustomStage3";

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  window.IntersectionObserver = MockIntersectionObserver as any;
});

afterEach(cleanup);



describe("CustomStage3: динамические цены из stageData", () => {
  it("отображает стандартные цены $49 и $99 по умолчанию", () => {
    render(<CustomStage3 onCTAClick={vi.fn()} isPhonePreview={true} />);
    expect(screen.getByText("$49")).toBeInTheDocument();
    expect(screen.getByText("$99")).toBeInTheDocument();
  });

  it("отображает переопределённые цены и символ валюты из stageData", () => {
    render(
      <CustomStage3
        onCTAClick={vi.fn()}
        isPhonePreview={true}
        stageData={{
          pkg1Price: 75,
          pkg1OldPrice: 199,
          pkg2Price: 149,
          pkg2OldPrice: 399,
          currencySymbol: "€",
        }}
      />,
    );
    expect(screen.getByText("€75")).toBeInTheDocument();
    expect(screen.getByText("€149")).toBeInTheDocument();
  });
});

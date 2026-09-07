// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import StagePhonePreview from "./StagePhonePreview";

afterEach(cleanup);

describe("StagePhonePreview", () => {
  it("renders the site with a real mobile CSS viewport inside the scaled phone frame", () => {
    render(<StagePhonePreview enabled funnelId="demo-sites-showcase" stageId="stage-0" />);

    const iframe = screen.getByTitle("Mobile-Preview-stage-0");
    expect(iframe).toHaveAttribute(
      "src",
      "/?funnel=demo-sites-showcase&stage=stage-0&preview=phone",
    );
    expect(iframe).toHaveStyle({ width: "390px", height: "812px" });
    expect(iframe.getAttribute("style")).toContain("scale(0.6871794871794872)");
  });
});

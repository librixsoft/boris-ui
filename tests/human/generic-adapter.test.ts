// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findTarget: vi.fn() }));

vi.mock("playwright", () => ({}));
vi.mock("../../src/main/browser/human/targeting", () => ({ findTarget: mocks.findTarget }));
vi.mock("../../src/main/browser/human/keyboard", () => ({ typeTextHuman: vi.fn() }));

import { clickText, readVisible } from "../../src/main/browser/human/adapters/generic";

describe("clickText", () => {
  it("lanza cuando no encuentra el texto", async () => {
    mocks.findTarget.mockResolvedValue(null);
    const page = { mouse: { click: vi.fn() } };
    await expect(clickText(page as never, "Nada")).rejects.toThrow('Generic adapter: text "Nada" not found');
  });

  it("hace click en las coordenadas encontradas", async () => {
    mocks.findTarget.mockResolvedValue({ x: 10, y: 20 });
    const click = vi.fn();
    const page = { mouse: { click } };
    await clickText(page as never, "Ok");
    expect(click).toHaveBeenCalledWith(10, 20);
  });
});

describe("readVisible", () => {
  it("excluye script/style/noscript", async () => {
    document.body.innerHTML = `
      <div>Visible</div>
      <script>hidden()</script>
      <style>.x{}</style>
      <noscript>ns</noscript>
      <p>Otro</p>
    `;
    const page = { evaluate: async (fn: () => string) => fn() };
    const text = await readVisible(page as never);

    expect(text).toContain("Visible");
    expect(text).toContain("Otro");
    expect(text).not.toContain("hidden()");
    expect(text).not.toContain(".x{}");
    expect(text).not.toContain("ns");
  });
});

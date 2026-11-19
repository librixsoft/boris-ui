import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const projectRoot = path.join(__dirname, "..", "..");

describe("No artefactos de debug en el proyecto", () => {
  it("no hay *.jsonl en la raiz del proyecto", () => {
    const rootJsonls = fs.readdirSync(projectRoot).filter((f) => f.endsWith(".jsonl") || f.endsWith(".jsonl.1"));
    expect(rootJsonls).toEqual([]);
  });

  it("no hay test artifacts bajo plans/", () => {
    const plansDir = path.join(projectRoot, "plans");
    if (!fs.existsSync(plansDir)) {
      return;
    }
    const plansJsons = fs.readdirSync(plansDir).filter((f) => f.endsWith(".jsonl"));
    expect(plansJsons).toEqual([]);
  });
});

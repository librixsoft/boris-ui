import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as os from "node:os";
import * as path from "node:path";

const renameCalls = vi.hoisted(() => [] as Array<[string, string]>);

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    renameSync: (from: string, to: string) => {
      renameCalls.push([from, to]);
      return actual.renameSync(from, to);
    }
  };
});

import * as fs from "node:fs";
import { readProfile, writeProfile, incrementSession } from "../../src/main/browser/human/profile";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "boris-profile-"));
  renameCalls.length = 0;
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("readProfile", () => {
  it("crea un profile por defecto cuando no existe", () => {
    const profile = readProfile(dir);
    expect(profile.version).toBe(1);
    expect(profile.sessionCounter).toBe(0);
    expect(profile.fingerprint).toEqual({});
    expect(typeof profile.profileSeed).toBe("number");
    expect(fs.existsSync(path.join(dir, "profile.json"))).toBe(true);
  });
});

describe("writeProfile", () => {
  it("escribe atómicamente vía .tmp y rename", () => {
    const profile = {
      version: 1 as const,
      profileSeed: 7,
      sessionCounter: 5,
      rampUpStartDate: "2026-01-01T00:00:00.000Z",
      fingerprint: { a: 1 }
    };

    writeProfile(dir, profile);

    const profilePath = path.join(dir, "profile.json");
    expect(fs.existsSync(profilePath)).toBe(true);
    expect(fs.existsSync(profilePath + ".tmp")).toBe(false);
    expect(renameCalls).toContainEqual([profilePath + ".tmp", profilePath]);
    expect(JSON.parse(fs.readFileSync(profilePath, "utf-8"))).toEqual(profile);
  });
});

describe("incrementSession", () => {
  it("incrementa el contador de sesiones", () => {
    expect(readProfile(dir).sessionCounter).toBe(0);
    expect(incrementSession(dir).sessionCounter).toBe(1);
    expect(incrementSession(dir).sessionCounter).toBe(2);
    expect(readProfile(dir).sessionCounter).toBe(2);
  });
});

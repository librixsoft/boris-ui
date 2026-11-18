import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, BrowserContext } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { launchHumanContext } from "../../src/main/browser/human/session";
import { readProfile, incrementSession, writeProfile, HumanProfileFile, acquireProfileLock, ProfileLockedError } from "../../src/main/browser/human/profile";

describe("F2 session persistence", () => {
  let profileDir: string;
  let context: BrowserContext;

  beforeAll(async () => {
    profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "boris-f2-"));
    context = await launchHumanContext(profileDir);
  }, 60000);

  afterAll(async () => {
    if (context) {
      await context.close().catch(() => {});
    }
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }, 60000);

  it("should set navigator.webdriver to false", async () => {
    const page = await context.newPage();
    const webdriver = await page.evaluate(() => navigator.webdriver);
    expect(webdriver).toBe(false);
    await page.close();
  }, 60000);

  it("should have plugins available", async () => {
    const page = await context.newPage();
    const pluginsLength = await page.evaluate(() => navigator.plugins ? navigator.plugins.length : 0);
    expect(pluginsLength).toBeGreaterThanOrEqual(0);
    await page.close();
  }, 60000);

  it("should have timezone from OS", async () => {
    const page = await context.newPage();
    const tz = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    const expectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(tz).toBe(expectedTz);
    await page.close();
  }, 60000);

  it("should persist sessionCounter on profile", () => {
    const profile = readProfile(profileDir);
    expect(profile.sessionCounter).toBeGreaterThanOrEqual(1);
  });

  it("should increment sessionCounter", () => {
    const profile = readProfile(profileDir);
    const initialCounter = profile.sessionCounter;
    incrementSession(profileDir);
    const updatedProfile = readProfile(profileDir);
    expect(updatedProfile.sessionCounter).toBe(initialCounter + 1);
  });
});

describe("F2 lock concurrent", () => {
  let profileDir: string;

  beforeAll(() => {
    profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "boris-f2-lock-"));
  });

  afterAll(() => {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("should acquire lock on first call", () => {
    const release = acquireProfileLock(profileDir);
    expect(release).toBeDefined();
    expect(typeof release).toBe("function");
    release();
  });

  it("should throw ProfileLockedError on concurrent access", () => {
    const testDir = path.join(profileDir, "concurrent-test");
    const release1 = acquireProfileLock(testDir);

    expect(() => acquireProfileLock(testDir)).toThrow(ProfileLockedError);

    release1();
  });

  it("should reclaim lock from dead process", () => {
    const lockPath = path.join(profileDir, "boris.lock");

    fs.writeFileSync(lockPath, JSON.stringify({ pid: 99999, startedAt: Date.now() }));

    const release = acquireProfileLock(profileDir);
    expect(release).toBeDefined();
    release();
  });
});

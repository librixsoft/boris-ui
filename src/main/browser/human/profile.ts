import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export class ProfileLockedError extends Error {
  constructor(dir: string, pid: number) {
    super(`Profile locked by another process (pid: ${pid}) in ${dir}`);
    this.name = "ProfileLockedError";
  }
}

export interface HumanProfileFile {
  version: 1;
  profileSeed: number;
  sessionCounter: number;
  rampUpStartDate: string;
  fingerprint: Record<string, unknown>;
}

function getProfilePath(dir: string): string {
  return path.join(dir, "profile.json");
}

function getLockPath(dir: string): string {
  return path.join(dir, "boris.lock");
}

export function readProfile(dir: string): HumanProfileFile {
  const profilePath = getProfilePath(dir);
  if (!fs.existsSync(profilePath)) {
    return createDefaultProfile(dir);
  }
  const content = fs.readFileSync(profilePath, "utf-8");
  return JSON.parse(content) as HumanProfileFile;
}

function createDefaultProfile(dir: string): HumanProfileFile {
  const profile: HumanProfileFile = {
    version: 1,
    profileSeed: parseInt(process.env.BORIS_HUMAN_SEED ?? "0x51ed2701", 16) || 0x51ed2701,
    sessionCounter: 0,
    rampUpStartDate: new Date().toISOString(),
    fingerprint: {},
  };
  writeProfile(dir, profile);
  return profile;
}

export function writeProfile(dir: string, profile: HumanProfileFile): void {
  const profilePath = getProfilePath(dir);
  const tmpPath = profilePath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(profile, null, 2));
  fs.renameSync(tmpPath, profilePath);
}

export function incrementSession(dir: string): HumanProfileFile {
  const profile = readProfile(dir);
  profile.sessionCounter++;
  writeProfile(dir, profile);
  return profile;
}

export function acquireProfileLock(dir: string): () => void {
  const lockPath = getLockPath(dir);
  fs.mkdirSync(dir, { recursive: true });

  try {
    const fd = fs.openSync(lockPath, "wx");
    fs.closeSync(fd);
    const lockData = JSON.stringify({ pid: process.pid, startedAt: Date.now() });
    fs.writeFileSync(lockPath, lockData);
    return () => {
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // Already released
      }
    };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST") {
      try {
        const content = fs.readFileSync(lockPath, "utf-8");
        const lockData = JSON.parse(content) as { pid: number; startedAt: number };
        let processAlive = true;
        try {
          process.kill(lockData.pid, 0);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === "ESRCH") {
            processAlive = false;
          }
        }
        if (processAlive) {
          throw new ProfileLockedError(dir, lockData.pid);
        }
        // Process dead, reclaim lock
        fs.unlinkSync(lockPath);
        try {
          const fd = fs.openSync(lockPath, "wx");
          fs.closeSync(fd);
          const lockData2 = JSON.stringify({ pid: process.pid, startedAt: Date.now() });
          fs.writeFileSync(lockPath, lockData2);
          return () => {
            try {
              fs.unlinkSync(lockPath);
            } catch {
              // Already released
            }
          };
        } catch {
          throw new ProfileLockedError(dir, lockData.pid);
        }
      } catch (err) {
        if (err instanceof ProfileLockedError) throw err;
        throw new ProfileLockedError(dir, 0);
      }
    }
    throw e;
  }
}

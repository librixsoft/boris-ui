import { describe, it, expect } from "vitest";
import { createTaskSessionControl } from "../src/renderer/taskSessionControl";

describe("createTaskSessionControl", () => {
  it("release antes de activar no rompe el estado", () => {
    const ctrl = createTaskSessionControl();
    expect(ctrl.getState().active).toBe(false);
    ctrl.release();
    expect(ctrl.getState().active).toBe(false);
  });

  it("release es idempotente", () => {
    const ctrl = createTaskSessionControl();
    ctrl.activate();
    expect(ctrl.getState().active).toBe(true);
    ctrl.release();
    ctrl.release();
    expect(ctrl.getState().active).toBe(false);
  });

  it("activate tras release vuelve a active", () => {
    const ctrl = createTaskSessionControl();
    ctrl.release();
    ctrl.activate();
    expect(ctrl.getState().active).toBe(true);
  });

  it("activate es idempotente", () => {
    const ctrl = createTaskSessionControl();
    ctrl.activate();
    ctrl.activate();
    expect(ctrl.getState().active).toBe(true);
  });

  it("getState refleja el último cambio", () => {
    const ctrl = createTaskSessionControl();
    ctrl.activate();
    expect(ctrl.getState().active).toBe(true);
    ctrl.release();
    expect(ctrl.getState().active).toBe(false);
  });
});

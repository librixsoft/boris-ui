export interface TaskSessionState {
  active: boolean;
}

export interface TaskSessionControl {
  activate(): TaskSessionState;
  release(): TaskSessionState;
  getState(): TaskSessionState;
}

export function createTaskSessionControl(initialActive = false): TaskSessionControl {
  let active = initialActive;
  return {
    activate() {
      active = true;
      return { active };
    },
    release() {
      active = false;
      return { active };
    },
    getState() {
      return { active };
    },
  };
}

export class FakeMouse {
  public readonly moves: { x: number; y: number }[] = [];
  public readonly wheels: { dx: number; dy: number }[] = [];
  public downCount = 0;
  public upCount = 0;
  async move(x: number, y: number): Promise<void> { this.moves.push({ x, y }); }
  async down(): Promise<void> { this.downCount++; }
  async up(): Promise<void> { this.upCount++; }
  async click(): Promise<void> {}
  async dblclick(): Promise<void> {}
  async wheel(dx: number, dy: number): Promise<void> { this.wheels.push({ dx, dy }); }
}

export class FakeKeyboard {
  public buffer = "";
  public keydowns: string[] = [];
  public keyups: string[] = [];
  private shift = false;
  async down(key: string): Promise<void> {
    this.keydowns.push(key);
    if (key === "Shift") { this.shift = true; return; }
    if (key.length === 1) this.buffer += this.shift ? key.toUpperCase() : key;
  }
  async up(key: string): Promise<void> {
    this.keyups.push(key);
    if (key === "Shift") this.shift = false;
  }
  async press(key: string): Promise<void> {
    if (key === "Backspace") this.buffer = this.buffer.slice(0, -1);
    else if (key.length === 1) this.buffer += key;
  }
}

export const noSleep = async (_ms: number): Promise<void> => {};

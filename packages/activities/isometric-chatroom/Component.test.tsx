import { describe, it, expect } from "vitest";
import Component from "./Component.js";

describe("isometric-chatroom Component", () => {
  it("exposes a default export (stub fallback until a real engine view ships)", () => {
    expect(Component).toBeDefined();
    expect(typeof Component).toBe("function");
  });
});

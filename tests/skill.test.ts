import { describe, it, expect } from "vitest";
import { loadSkill, buildSystemPrompt } from "@/lib/skill";

describe("loadSkill", () => {
  it("returns SKILL.md content as a non-empty string", () => {
    const skill = loadSkill();
    expect(skill).toBeTypeOf("string");
    expect(skill.length).toBeGreaterThan(100);
  });

  it("includes the structured-capture mode header", () => {
    const skill = loadSkill();
    expect(skill).toMatch(/Structured Capture/);
  });
});

describe("buildSystemPrompt", () => {
  it("includes today's date verbatim", () => {
    const prompt = buildSystemPrompt("2026-05-04");
    expect(prompt).toMatch(/2026-05-04/);
  });

  it("includes SKILL.md content", () => {
    const prompt = buildSystemPrompt("2026-05-04");
    expect(prompt).toMatch(/Structured Capture/);
  });

  it("appends JSON output instructions after SKILL.md", () => {
    const prompt = buildSystemPrompt("2026-05-04");
    const skillIdx = prompt.indexOf("Structured Capture");
    const jsonIdx = prompt.indexOf("RESPONSE FORMAT OVERRIDE");
    expect(skillIdx).toBeGreaterThan(-1);
    expect(jsonIdx).toBeGreaterThan(skillIdx);
  });

  it("instructs Claude to use flags object instead of trailing ?", () => {
    const prompt = buildSystemPrompt("2026-05-04");
    expect(prompt).toMatch(/flags/);
    expect(prompt).toMatch(/instead of/i);
  });

  it("specifies the JSON schema with all enum values", () => {
    const prompt = buildSystemPrompt("2026-05-04");
    expect(prompt).toMatch(/Personal Project/);
    expect(prompt).toMatch(/P1 – Critical/);
    expect(prompt).toMatch(/Planned/);
    expect(prompt).toMatch(/Backlog/);
  });
});

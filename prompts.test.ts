import {describe,expect,it} from "vitest";
import {INTAKE_PROMPT,NEGOTIATION_PROMPT} from "./prompts.js";

describe("voice-agent prompt boundaries",()=>{
  it("prevents the intake agent from recording its own speech as provider evidence",()=>{
    expect(INTAKE_PROMPT).toContain("Never pass your own words");
    expect(INTAKE_PROMPT).toContain("Never call record_provider_answer immediately after your own message");
  });

  it("requires a single silent close after spoken confirmation",()=>{
    for(const prompt of [INTAKE_PROMPT,NEGOTIATION_PROMPT]){
      expect(prompt).toContain("Finish all spoken questions and confirmations before calling close_call");
      expect(prompt).toContain("Call close_call silently exactly once");
    }
  });

  it("handles holds without robotic presence-check loops",()=>{
    expect(INTAKE_PROMPT).toContain("acknowledge once and wait silently");
    expect(INTAKE_PROMPT).toContain("Do not repeat \"are you still there\"");
  });
});

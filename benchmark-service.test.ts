import { describe,expect,it } from "vitest";
import { benchmarkSandboxIntake } from "./benchmark-service.js";

describe("benchmark workflow bridge",()=>{
  it("uses the separate source-backed vertical without discovering real providers",async()=>{
    const result=await benchmarkSandboxIntake({vehicle:{year:2021,make:"Volkswagen",model:"Tiguan",vin:null},damage:{service:"REPLACEMENT",type:"CRACK",location:"CENTER",drivable:true},features:["FRONT_CAMERA"],postalCode:"28202",insuranceInvolved:false,schedulePreference:null});
    expect(result.handoff.providers).toEqual([]);
    expect(result.benchmark).toMatchObject({classification:"ESTIMATED",sourceLabel:"Source-backed published auto-glass range"});
    expect(result.context.evidence.length).toBeGreaterThan(0);
    expect(result.context.warnings.join(" ")).toContain("directional");
  });
});

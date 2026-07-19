import { z } from "zod";

const Vin = z.string().trim().toUpperCase().regex(/^[A-HJ-NPR-Z0-9]{17}$/, "VIN must be 17 characters and cannot contain I, O, or Q");
const VpicResponse = z.object({ Results: z.array(z.record(z.string(), z.union([z.string(), z.null()]))).min(1) });
export type VinDecode = { vin:string;year:number;make:string;model:string;trim:string|null;bodyClass:string|null;vehicleType:string|null;adasLikely:boolean;adasEvidence:string[];source:{kind:"NHTSA_VPIC";classification:"VERIFIED_VIN_DECODE";label:string;decodedAt:string} };

export async function decodeVin(rawVin:string, fetcher:typeof fetch=fetch):Promise<VinDecode>{
  const vin=Vin.parse(rawVin);const url=`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`;
  let response:Response;try{response=await fetcher(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(6000)})}catch{throw new Error("VIN lookup is temporarily unavailable; try again without re-entering vehicle details")}
  if(!response.ok)throw new Error(`VIN lookup failed (${response.status})`);const parsed=VpicResponse.parse(await response.json());const value=parsed.Results[0];
  if(String(value.ErrorCode??"").split(",").some(code=>code.trim()!=="0"))throw new Error(String(value.ErrorText??"VIN could not be decoded"));
  const year=Number(value.ModelYear);const make=String(value.Make??"").trim();const model=String(value.Model??"").trim();if(!Number.isInteger(year)||!make||!model)throw new Error("NHTSA did not return a complete year/make/model for this VIN");
  const featureFields:Array<[string,string]>=[["ForwardCollisionWarning","Forward collision warning"],["LaneDepartureWarning","Lane departure warning"],["LaneKeepSystem","Lane keeping assistance"],["AdaptiveCruiseControl","Adaptive cruise control"],["DynamicBrakeSupport","Dynamic brake support"]];
  const adasEvidence=featureFields.flatMap(([key,label])=>{const status=String(value[key]??"").trim();return status&&status!=="Not Applicable"?[`${label}: ${status}`]:[]});
  return{vin,year,make,model,trim:String(value.Trim??"").trim()||null,bodyClass:String(value.BodyClass??"").trim()||null,vehicleType:String(value.VehicleType??"").trim()||null,adasLikely:adasEvidence.length>0,adasEvidence,source:{kind:"NHTSA_VPIC",classification:"VERIFIED_VIN_DECODE",label:"NHTSA vPIC DecodeVinValuesExtended",decodedAt:new Date().toISOString()}};
}

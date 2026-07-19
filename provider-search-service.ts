import { Provider } from "./domain.js";

function requireSandboxNumber(env:NodeJS.ProcessEnv){
  const value=(env.SANDBOX_PROVIDER_NUMBER??env.PERSONA_TO_NUMBER??"").trim();
  if(!/^\+[1-9]\d{7,14}$/.test(value))throw new Error("SANDBOX_PROVIDER_NUMBER is required and must be a valid E.164 number");
  return value;
}

export function discoverSandboxProviders(postalCode:string,env:NodeJS.ProcessEnv=process.env){
  if((env.CALL_MODE??"SANDBOX")!=="SANDBOX")throw new Error("Only SANDBOX call mode is enabled in this build");
  const providers=[Provider.parse({
    providerId:"sandbox_provider",
    name:env.SANDBOX_PROVIDER_NAME?.trim()||"Sandbox Auto Glass Provider 1",
    phoneNumber:requireSandboxNumber(env),
    locationLabel:`Sandbox destination for ZIP ${postalCode}`,
    source:"SANDBOX_CONFIG",
    verified:true,
  })];
  for(const index of [2,3]){
    const name=env[`SANDBOX_PROVIDER_${index}_NAME`]?.trim()??"",number=env[`SANDBOX_PROVIDER_${index}_NUMBER`]?.trim()??"";
    if(!name&&!number)continue;
    if(!name||!/^\+[1-9]\d{7,14}$/.test(number))throw new Error(`SANDBOX_PROVIDER_${index}_NAME and SANDBOX_PROVIDER_${index}_NUMBER must both be configured; number must use E.164 format`);
    providers.push(Provider.parse({providerId:`sandbox_provider_${index}`,name,phoneNumber:number,locationLabel:`Sandbox destination ${index} for ZIP ${postalCode}`,source:"SANDBOX_CONFIG",verified:true}));
  }
  if(new Set(providers.map(p=>p.phoneNumber)).size!==providers.length)throw new Error("Sandbox provider phone numbers must be unique for multi-provider comparison");
  return providers;
}

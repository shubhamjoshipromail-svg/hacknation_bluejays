import { Provider } from "./domain.js";

function requireSandboxNumber(env:NodeJS.ProcessEnv){
  const value=(env.SANDBOX_PROVIDER_NUMBER??env.PERSONA_TO_NUMBER??"").trim();
  if(!/^\+[1-9]\d{7,14}$/.test(value))throw new Error("SANDBOX_PROVIDER_NUMBER is required and must be a valid E.164 number");
  return value;
}

export function discoverSandboxProviders(postalCode:string,env:NodeJS.ProcessEnv=process.env){
  if((env.CALL_MODE??"SANDBOX")!=="SANDBOX")throw new Error("Only SANDBOX call mode is enabled in this build");
  const provider=Provider.parse({
    providerId:"sandbox_provider",
    name:env.SANDBOX_PROVIDER_NAME?.trim()||"Sandbox Auto Glass Provider",
    phoneNumber:requireSandboxNumber(env),
    locationLabel:`Sandbox destination for ZIP ${postalCode}`,
    source:"SANDBOX_CONFIG",
    verified:true,
  });
  return [provider];
}

import "dotenv/config";
const BASE="https://api.elevenlabs.io/v1";
export function requireEnv(...names:string[]){const missing=names.filter(n=>!process.env[n]);if(missing.length)throw new Error(`Missing environment variables: ${missing.join(", ")}`);return Object.fromEntries(names.map(n=>[n,process.env[n]!]))}
export async function eleven<T>(path:string,init:RequestInit={}){const key=process.env.ELEVENLABS_API_KEY;if(!key)throw new Error("Missing ELEVENLABS_API_KEY");const response=await fetch(`${BASE}${path}`,{...init,headers:{"xi-api-key":key,"content-type":"application/json",...init.headers}});const text=await response.text();if(!response.ok)throw new Error(`ElevenLabs ${response.status} ${path}: ${text}`);return(text?JSON.parse(text):{}) as T}

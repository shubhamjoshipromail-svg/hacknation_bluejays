import fs from "node:fs";
import YAML from "yaml";
import { mutate } from "./store.js";
type Tactic={honesty_class:"ALWAYS_ALLOWED"|"TRUTHFUL_REQUIRES_POLICY_ALLOW"|"TRUTHFUL_REQUIRES_USER_AUTHORIZATION";phrasing_pattern:string;log_as:string};
type Playbook={tactics:Record<string,Tactic>;selection_rules:{observed:{style:string;example?:string};plan:string[]}[]};
const playbook:Playbook=YAML.parse(fs.readFileSync("negotiation-playbook.yaml","utf8"));
export function planNegotiation(summary:string,authorization:{policyAllow:boolean;userTradeoffs:boolean}){const normalized=summary.toLowerCase();const rule=playbook.selection_rules.find(r=>normalized.includes(r.observed.style)||Boolean(r.observed.example&&normalized.includes(r.observed.example)));return(rule?.plan??[]).filter(name=>{const klass=playbook.tactics[name].honesty_class;return klass==="ALWAYS_ALLOWED"||(klass==="TRUTHFUL_REQUIRES_POLICY_ALLOW"&&authorization.policyAllow)||(klass==="TRUTHFUL_REQUIRES_USER_AUTHORIZATION"&&authorization.userTradeoffs)}).map(name=>({name,...playbook.tactics[name]}))}
export function logTimeline(type:"TACTIC"|"TRIGGER",name:string,callId:string,detail?:string){console.log(`[${type}] ${name}${detail?`: ${detail}`:""}`);mutate(s=>s.timelineEvents.push({type,name,callId,detail,at:new Date().toISOString()}))}

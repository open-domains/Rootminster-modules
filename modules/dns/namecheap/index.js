function xmlValue(xml,tag){return xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`,"i"))?.[1];}
function params(ctx,command,extra={}){return new URLSearchParams({ApiUser:ctx.config.apiUser,ApiKey:ctx.config.apiKey,UserName:ctx.config.username,ClientIp:ctx.config.clientIp,Command:command,...extra});}
async function call(ctx,command,extra){const host=ctx.config.sandbox?"https://api.sandbox.namecheap.com":"https://api.namecheap.com";const res=await ctx.fetch(`${host}/xml.response?${params(ctx,command,extra)}`);const xml=await res.text();if(!res.ok||/<Errors>/i.test(xml))throw new Error(xmlValue(xml,"Error")||`Namecheap HTTP ${res.status}`);return xml;}
function split(domain){const p=domain.split(".");if(p.length<2)throw new Error("Invalid domain");return {SLD:p.slice(0,-1).join("."),TLD:p.at(-1)};}
export default {
 async health(ctx){await call(ctx,"namecheap.users.getBalances");return {ok:true};},
 async listRecords(ctx,zone){const xml=await call(ctx,"namecheap.domains.dns.getHosts",split(zone.name));return [...xml.matchAll(/<host\s+([^>]+)\/>/gi)].map(([,a])=>Object.fromEntries([...a.matchAll(/(\w+)="([^"]*)"/g)].map(x=>[x[1],x[2]])));},
 async replaceRecords(ctx,zone,records){const data={...split(zone.name)};records.forEach((r,i)=>{const n=i+1;data[`HostName${n}`]=r.name;data[`RecordType${n}`]=r.type;data[`Address${n}`]=r.content;data[`TTL${n}`]=String(r.ttl||1800);if(r.mxPref!=null)data[`MXPref${n}`]=String(r.mxPref);});await call(ctx,"namecheap.domains.dns.setHosts",data);return {updated:true};}
};

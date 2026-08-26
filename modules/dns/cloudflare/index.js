const api="https://api.cloudflare.com/client/v4";
async function request(ctx,path,options={}){
 const res=await ctx.fetch(api+path,{...options,headers:{Authorization:`Bearer ${ctx.config.apiToken}`,"Content-Type":"application/json",...options.headers}});
 const body=await res.json(); if(!res.ok||!body.success) throw new Error(body.errors?.[0]?.message||`Cloudflare HTTP ${res.status}`); return body.result;
}
async function zoneId(ctx,zone){if(zone.id)return zone.id;const rows=await request(ctx,`/zones?name=${encodeURIComponent(zone.name)}`);if(rows.length!==1)throw new Error("Cloudflare zone not found");return rows[0].id;}
export default {
 async health(ctx){await request(ctx,"/user/tokens/verify");return {ok:true};},
 async listRecords(ctx,zone){return request(ctx,`/zones/${await zoneId(ctx,zone)}/dns_records?per_page=5000000`);},
 async createRecord(ctx,zone,record){return request(ctx,`/zones/${await zoneId(ctx,zone)}/dns_records`,{method:"POST",body:JSON.stringify(record)});},
 async updateRecord(ctx,zone,id,record){return request(ctx,`/zones/${await zoneId(ctx,zone)}/dns_records/${id}`,{method:"PUT",body:JSON.stringify(record)});},
 async deleteRecord(ctx,zone,id){await request(ctx,`/zones/${await zoneId(ctx,zone)}/dns_records/${id}`,{method:"DELETE"});return {deleted:true};}
};

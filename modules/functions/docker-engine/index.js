import Docker from "dockerode";
function client(config){return new Docker({socketPath:config.socketPath||"/var/run/docker.sock"});}
function allowed(config,info){const wanted=config.allowedLabels||{};return Object.entries(wanted).every(([k,v])=>info.Config?.Labels?.[k]===v);}
async function container(ctx,id){const d=client(ctx.config),c=d.getContainer(id),info=await c.inspect();if(!allowed(ctx.config,info))throw new Error("Container is outside the module allow-list");return c;}
export default {
 async health(ctx){return client(ctx.config).ping().then(()=>({ok:true}));},
 async list(ctx){const d=client(ctx.config);const rows=await d.listContainers({all:true,filters:JSON.stringify({label:Object.entries(ctx.config.allowedLabels||{}).map(([k,v])=>`${k}=${v}`)})});return rows;},
 async inspect(ctx,id){return (await container(ctx,id)).inspect();},
 async start(ctx,id){await (await container(ctx,id)).start();return {started:true};},
 async stop(ctx,id){await (await container(ctx,id)).stop();return {stopped:true};},
 async restart(ctx,id){await (await container(ctx,id)).restart();return {restarted:true};}
};

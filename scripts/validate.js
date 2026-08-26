import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,"registry.json"),"utf8"));
const ids=new Set(), allowed=new Set(["dns","email","oauth","function"]);
for(const item of registry.modules){
 if(ids.has(item.id)) throw new Error(`Duplicate module id: ${item.id}`); ids.add(item.id);
 const dir=path.join(root,item.path);
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,"module.json"),"utf8"));
 for(const key of ["schemaVersion","id","name","version","category","main","engines","permissions","configSchema","secrets"]) if(manifest[key]===undefined) throw new Error(`${item.id}: missing ${key}`);
 if(manifest.id!==item.id||manifest.version!==item.version||manifest.category!==item.category) throw new Error(`${item.id}: registry mismatch`);
 if(!allowed.has(manifest.category)) throw new Error(`${item.id}: invalid category`);
 if(!fs.existsSync(path.join(dir,manifest.main))) throw new Error(`${item.id}: entry point missing`);
}
console.log(`Validated ${registry.modules.length} Rootminster modules.`);

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,"registry.json"),"utf8"));
const ids=new Set();
const types=new Set(["dns-provider","email-provider","oauth-provider","notification-provider","captcha-provider","feature"]);

for(const item of registry.modules){
  for(const field of ["id","name","version","type","description","downloadUrl","sha256"]) if(!item[field]) throw new Error(`${item.id||"module"}: missing ${field}`);
  if(ids.has(item.id)) throw new Error(`Duplicate module id: ${item.id}`);
  ids.add(item.id);
  if(!types.has(item.type)) throw new Error(`${item.id}: invalid type`);
  const archiveName=new URL(item.downloadUrl).pathname.split("/").at(-1);
  const archivePath=path.join(root,"dist",archiveName);
  const archive=fs.readFileSync(archivePath);
  const actual=crypto.createHash("sha256").update(archive).digest("hex");
  if(actual!==item.sha256) throw new Error(`${item.id}: archive checksum mismatch`);
  const source=["dns","email","oauth","notifications","captcha","features"].map(category=>path.join(root,"modules",category,item.id,"module.json")).find(fs.existsSync);
  if(!source) throw new Error(`${item.id}: source manifest missing`);
  const manifest=JSON.parse(fs.readFileSync(source,"utf8"));
  if(manifest.id!==item.id||manifest.version!==item.version||manifest.type!==item.type) throw new Error(`${item.id}: catalogue does not match manifest`);
}
console.log(`Validated ${registry.modules.length} Rootminster modules and archives.`);

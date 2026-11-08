#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

const CATALOG_URL = new URL(process.env.CATALOG_URL || 'https://mcmanussliam.github.io/screenshots-design-inspiration/catalog.json');
if (!['https:', 'http:'].includes(CATALOG_URL.protocol)) throw new Error('CATALOG_URL must use HTTP or HTTPS.');
const TTL = 10 * 60_000;
let snapshot, expires = 0, inflight;
async function catalog() {
  if (snapshot && Date.now() < expires) return snapshot;
  if (inflight) return inflight;
  inflight = (async () => {
    const response = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(15000), headers:{accept:'application/json'} });
    if (!response.ok) throw new Error('Catalogue is unavailable ('+response.status+').');
    const body = await response.json();
    if (!body || !Array.isArray(body.products) || body.version !== 1) throw new Error('Unexpected catalogue format.');
    snapshot = body; expires = Date.now()+TTL; return body;
  })();
  try { return await inflight; } finally { inflight = undefined; }
}
const reply = body => ({ content:[{type:'text',text:JSON.stringify(body,null,2)}] });
const error = err => ({isError:true,content:[{type:'text',text:String(err?.message||err)}]});
const run = async fn => { try {return reply(await fn());}catch(err){return error(err);} };
const platform = z.enum(['ios','android','web','email','marketing']);
serveStdio(() => {
 const server = new McpServer({name:'open-screens',version:'1.0.0'},{
  instructions:'Read-only design reference catalogue. Use search_products to find products, search_screenshots for UI patterns and get_product for screenshot image URLs. Images belong to their respective owners; this MCP does not alter or redistribute the source files.'
 });
 server.registerTool('search_products',{
  description:'Search products by name, platform, tags or screenshot design patterns.',
  inputSchema:z.object({query:z.string().max(150).optional(),platform:platform.optional(),kind:z.enum(['app','site']).optional(),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(50).default(20)})
 },({query='',platform:platformFilter,kind,offset,limit})=>run(async()=>{
  const {products}=await catalog(),term=query.trim().toLowerCase();
  const found=products.filter(p=>(!platformFilter||p.platform===platformFilter)&&(!kind||p.kind===kind)&&
    (!term||[p.name,p.category,...p.tags,...p.screenshots.flatMap(s=>s.tags)].join(' ').toLowerCase().includes(term)));
  return {total:found.length,offset,results:found.slice(offset,offset+limit).map(p=>({id:p.id,name:p.name,platform:p.platform,kind:p.kind,category:p.category,tags:p.tags,screen_count:p.screenshots.length,preview_url:p.screenshots[0]?.url}))};
 }));
 server.registerTool('get_product',{
  description:'Get a product by stable ID, including paginated screenshot URLs and per-screen tags.',
  inputSchema:z.object({id:z.string().min(1).max(150),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(50).default(25)})
 },({id,offset,limit})=>run(async()=>{
  const {products}=await catalog(),p=products.find(p=>p.id===id);
  if(!p)throw new Error('Product not found: '+id);
  const {screenshots,...metadata}=p;
  return {...metadata,total:screenshots.length,offset,screenshots:screenshots.slice(offset,offset+limit),next_offset:offset+limit<screenshots.length?offset+limit:null};
 }));
 server.registerTool('search_screenshots',{
  description:'Find screenshots with UI element/pattern tags and optional product name or platform.',
  inputSchema:z.object({query:z.string().max(150).optional(),tag:z.string().max(100).optional(),platform:platform.optional(),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(50).default(20)})
 },({query='',tag='',platform:platformFilter,offset,limit})=>run(async()=>{
  const {products}=await catalog(),term=query.toLowerCase().trim(),t=tag.toLowerCase().trim(),results=[];
  for(const p of products){
   if(platformFilter && p.platform!==platformFilter)continue;
   for(const shot of p.screenshots){
    if(t&&!shot.tags.some(x=>x.toLowerCase()===t))continue;
    if(term&&![p.name,shot.name,...shot.tags].join(' ').toLowerCase().includes(term))continue;
    results.push({product_id:p.id,product_name:p.name,platform:p.platform,...shot});
   }
  }
  return {total:results.length,offset,results:results.slice(offset,offset+limit)};
 }));
 server.registerTool('list_tags',{
  description:'List common screenshot UI pattern tags and their usage frequencies.',
  inputSchema:z.object({limit:z.number().int().min(1).max(150).default(40)})
 },({limit})=>run(async()=>{
  const {products}=await catalog(),counts=new Map();
  for(const p of products)for(const s of p.screenshots)for(const tag of s.tags)counts.set(tag,(counts.get(tag)||0)+1);
  return {tags:[...counts].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([tag,count])=>({tag,count}))};
 }));
 return server;
});

const KEY = 'open-screens:v1';
type Collection = {name:string;items:string[]};
type SavedData = {collections:Record<string,Collection>};
function empty():SavedData {return {collections:{default:{name:'All saved',items:[]}}};}
function clean(input:unknown):SavedData {
  const result=empty();
  if(!input||typeof input!=='object')return result;
  const raw=(input as SavedData).collections;
  if(!raw||typeof raw!=='object')return result;
  for(const [key,value] of Object.entries(raw)){
    if(!/^[a-z0-9-]{1,60}$/.test(key) || !value || typeof value.name!=='string'|| !Array.isArray(value.items))continue;
    const items=[...new Set(value.items.filter((v):v is string=>typeof v==='string' && /^[a-z]+:[a-z0-9-]+$/.test(v)))].slice(0,5000);
    result.collections[key]={name:value.name.slice(0,70),items};
  }
  if(!result.collections.default)result.collections.default={name:'All saved',items:[]};
  return result;
}
function readSaved():SavedData{
  try{return clean(JSON.parse(localStorage.getItem(KEY)||'null'));}catch{return empty();}
}
function writeSaved(data:SavedData){
  try{localStorage.setItem(KEY,JSON.stringify(data));}catch{alert('Local storage is unavailable. Try exporting your collections as a backup.');}
  renderSaved();
}
function allSaved(data:SavedData){return new Set(Object.values(data.collections).flatMap(c=>c.items));}
function saveItem(id:string){
  const data=readSaved();
  const ids=allSaved(data);
  if(ids.has(id)) for(const collection of Object.values(data.collections))collection.items=collection.items.filter(x=>x!==id);
  else data.collections.default.items.push(id);
  writeSaved(data);
}
let activeCollection='default';
function renderSaved(){
  const data=readSaved();
  const ids=allSaved(data);
  document.querySelectorAll<HTMLButtonElement>('[data-save]').forEach(button=>{
    const id=button.dataset.save||'',isSaved=ids.has(id);
    button.setAttribute('aria-pressed',String(isSaved));
    button.classList.toggle('is-saved',isSaved);
    if(button.classList.contains('white-button'))button.textContent=isSaved?'♥ Saved':'♡ Save';
  });
  const tabs=document.getElementById('collection-tabs');
  if(tabs){
    tabs.replaceChildren();
    for(const [key,collection] of Object.entries(data.collections)){
      const button=document.createElement('button');
      button.type='button';button.textContent=collection.name;button.dataset.collection=key;
      if(key===activeCollection)button.classList.add('selected');
      tabs.append(button);
    }
  }
  const visible=activeCollection==='default'?ids:new Set(data.collections[activeCollection]?.items||[]);
  let found=0;
  document.querySelectorAll<HTMLElement>('[data-saved-id]').forEach(card=>{
    card.hidden=!visible.has(card.dataset.savedId||'');
    if(!card.hidden)found++;
  });
  const emptyState=document.getElementById('empty-saved');
  if(emptyState)emptyState.hidden=found>0;
  document.querySelectorAll<HTMLSelectElement>('[data-assign]').forEach(select=>{
    const id=select.dataset.assign||'';
    select.replaceChildren(new Option('Add to collection',''));
    for(const [key,collection] of Object.entries(data.collections)){
      if(key==='default')continue;
      select.add(new Option((collection.items.includes(id)?'✓ ':'')+collection.name,key));
    }
  });
}
function rootUrl(){
  return (document.querySelector<HTMLAnchorElement>('.brand')?.href)||'/';
}
function goSearch(query:string,kind=''){
  const url=new URL(rootUrl(),location.href);
  if(query)url.searchParams.set('q',query);
  if(kind)url.searchParams.set('view',kind);
  location.href=url.toString()+'#browse';
}
function setupBrowse(){
  const grid=document.getElementById('product-grid');
  if(!grid)return;
  const cards=[...grid.querySelectorAll<HTMLElement>('[data-product]')];
  let kind='app',platform='all',sort='featured',tag='',query='';
  const url=new URL(location.href);
  if(url.searchParams.get('view')==='apps')kind='app';
  if(url.searchParams.get('view')==='sites')kind='site';
  query=url.searchParams.get('q')||'';
  const input=document.querySelector<HTMLInputElement>('#global-search');
  if(input)input.value=query;
  function choose(group:string,value:string){
    document.querySelectorAll<HTMLButtonElement>('[data-'+group+']').forEach(btn=>{
      btn.classList.toggle('selected',btn.dataset[group]===value);
    });
  }
  function run(){
    let count=0;
    const needle=query.trim().toLocaleLowerCase();
    for(const card of cards){
      const show=(kind==='all'||card.dataset.kind===kind) &&
        (platform==='all'||card.dataset.platform===platform) &&
        (!tag||(card.dataset.search||'').includes(tag.toLocaleLowerCase())) &&
        (!needle||(card.dataset.search||'').includes(needle));
      card.hidden=!show;if(show)count++;
    }
    const order=sort==='alpha'?
      [...cards].sort((a,b)=>(a.dataset.name||'').localeCompare(b.dataset.name||'')):
      sort==='screens'?[...cards].sort((a,b)=>Number(b.dataset.screens||0)-Number(a.dataset.screens||0)):cards;
    for(const card of order)grid.append(card);
    const counter=document.getElementById('results-counter');
    if(counter)counter.textContent=count+' product'+(count===1?'':'s');
    const empty=document.getElementById('no-matches');if(empty)empty.hidden=count!==0;
    choose('kind',kind);choose('platform',platform);choose('sort',sort);
  }
  document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(btn=>
    btn.addEventListener('click',()=>{kind=btn.dataset.kind||'all';run();}));
  document.querySelectorAll<HTMLButtonElement>('[data-platform]').forEach(btn=>
    btn.addEventListener('click',()=>{platform=btn.dataset.platform||'all';run();}));
  document.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach(btn=>
    btn.addEventListener('click',()=>{sort=btn.dataset.sort||'featured';run();}));
  input?.addEventListener('input',()=>{query=input.value;run();});
  document.querySelectorAll<HTMLButtonElement>('[data-quick-search]').forEach(btn=>
    btn.addEventListener('click',()=>{query=btn.dataset.quickSearch||'';if(input)input.value=query;run();document.getElementById('browse')?.scrollIntoView();}));
  const tagSelect=document.querySelector<HTMLSelectElement>('#tag-select');
  tagSelect?.addEventListener('change',()=>{tag=tagSelect.value;run();});
  document.getElementById('reset-filters')?.addEventListener('click',()=>{
    kind=platform='all';query=tag='';if(input)input.value='';if(tagSelect)tagSelect.value='';run();
  });
  document.getElementById('toggle-filters')?.addEventListener('click',event=>{
    const panel=document.getElementById('filter-panel');if(!panel)return;
    panel.hidden=!panel.hidden;
    (event.currentTarget as HTMLElement).setAttribute('aria-expanded',String(!panel.hidden));
  });
  run();
}
function setupSaved(){
  const tabs=document.getElementById('collection-tabs');
  tabs?.addEventListener('click',event=>{
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-collection]');
    if(!button)return;activeCollection=button.dataset.collection||'default';renderSaved();
  });
  document.getElementById('create-collection')?.addEventListener('click',()=>{
    const title=prompt('Name your collection')?.trim();
    if(!title)return;
    const data=readSaved();
    const id='collection-'+Date.now().toString(36);
    data.collections[id]={name:title.slice(0,70),items:[]};
    activeCollection=id;writeSaved(data);
  });
  document.getElementById('saved-products')?.addEventListener('click',event=>{
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-unsave]');
    if(!button)return;const id=button.dataset.unsave||'',data=readSaved();
    for(const collection of Object.values(data.collections))collection.items=collection.items.filter(x=>x!==id);
    writeSaved(data);
  });
  document.getElementById('saved-products')?.addEventListener('change',event=>{
    const select=(event.target as HTMLElement).closest<HTMLSelectElement>('[data-assign]');
    if(!select?.value)return;
    const data=readSaved(),id=select.dataset.assign||'',collection=data.collections[select.value];
    if(!collection)return;
    if(collection.items.includes(id))collection.items=collection.items.filter(x=>x!==id);
    else collection.items.push(id);
    writeSaved(data);
  });
  document.getElementById('export-collections')?.addEventListener('click',()=>{
    const file=new Blob([JSON.stringify(readSaved(),null,2)],{type:'application/json'});
    const href=URL.createObjectURL(file),link=document.createElement('a');
    link.href=href;link.download='saved-collections.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(href),1000);
  });
  document.getElementById('import-collections')?.addEventListener('change',async(event)=>{
    const input=event.currentTarget as HTMLInputElement,file=input.files?.[0];
    if(!file)return;
    if(file.size>2_000_000){alert('Import file is too large.');return;}
    try{
      const parsed=JSON.parse(await file.text());
      if(!parsed||typeof parsed!=='object'||!parsed.collections)throw new Error('Invalid collection file');
      if(!confirm('Replace your saved collections with this file?'))return;
      activeCollection='default';writeSaved(clean(parsed));
    }catch{alert('Could not import this file.');}finally{input.value='';}
  });
}
function setupScreens(){
  const filter=document.querySelector<HTMLInputElement>('#screen-filter');
  filter?.addEventListener('input',()=>{
    let count=0;
    document.querySelectorAll<HTMLElement>('[data-shot-text]').forEach(item=>{
      item.hidden=!(item.dataset.shotText||'').includes(filter.value.toLowerCase().trim());
      if(!item.hidden)count++;
    });
    const no=document.getElementById('no-screens');
    if(no)no.hidden=count>0;
  });
  const typeSelect=document.querySelector<HTMLSelectElement>('#screen-type-filter');
  function filterScreens(){
    const term=filter?.value.toLowerCase().trim()||'';
    const type=typeSelect?.value.toLowerCase().trim()||'';
    let matched=0;
    document.querySelectorAll<HTMLElement>('[data-shot-text]').forEach(item=>{
      const show=(!term||(item.dataset.shotText||'').includes(term))&&
        (!type||(item.dataset.screenTypes||'').split('|').includes(type));
      item.hidden=!show;if(show)matched++;
    });
    const empty=document.getElementById('no-screens');
    if(empty)empty.hidden=matched>0;
  }
  filter?.addEventListener('input',filterScreens);
  typeSelect?.addEventListener('change',filterScreens);
  document.querySelectorAll<HTMLImageElement>('img.shot-img').forEach(img=>{
    const update=()=>{
      const width=Number(img.dataset.width)||img.naturalWidth;
      const height=Number(img.dataset.height)||img.naturalHeight;
      if(!width||!height)return;
      const label=img.closest('.screen-item')?.querySelector<HTMLElement>('[data-size-label]');
      if(label){label.textContent=width.toLocaleString('en')+' × '+height.toLocaleString('en')+' px';
       label.title='Original image resolution';}
    };
    img.addEventListener('load',update,{once:true});
    if(img.complete)update();
  });
  const dialog=document.querySelector<HTMLDialogElement>('#preview');
  document.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach(btn=>btn.addEventListener('click',()=>{
    const img=document.querySelector<HTMLImageElement>('#preview-image');
    if(img){img.src=btn.dataset.preview||'';img.alt=btn.dataset.caption||'Screenshot preview';}
    const caption=document.getElementById('preview-caption');if(caption)caption.textContent=btn.dataset.caption||'';
    dialog?.showModal();
  }));
  document.querySelector('[data-close-preview]')?.addEventListener('click',()=>dialog?.close());
  dialog?.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
}
document.addEventListener('click',event=>{
  const btn=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-save]');
  if(btn){event.preventDefault();saveItem(btn.dataset.save||'');}
});
document.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();document.querySelector<HTMLInputElement>('#global-search')?.focus();
  }
});
const globalSearch=document.querySelector<HTMLInputElement>('#global-search');
if(!document.getElementById('product-grid')){
  globalSearch?.addEventListener('keydown',event=>{if(event.key==='Enter')goSearch(globalSearch.value);});
}

function setupScrollPreviews(){
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  const slowConnection=(navigator as Navigator & {connection?:{saveData?:boolean}}).connection?.saveData;
  if(reduceMotion||slowConnection)return;
  const cards=[...document.querySelectorAll<HTMLElement>('[data-gallery-card]')];
  const visible=new Set<HTMLElement>();
  const frames=new WeakMap<HTMLElement,string[]>();
  const positions=new WeakMap<HTMLElement,number>();
  for(const card of cards){
    try{frames.set(card,JSON.parse(card.dataset.scrollImages||'[]'));}catch{frames.set(card,[]);}
  }
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      const card=entry.target as HTMLElement;
      if(entry.isIntersecting&&entry.intersectionRatio>=0.6){
        if((frames.get(card)||[]).length>=3)visible.add(card);
      }else{
        visible.delete(card);
        const img=card.querySelector<HTMLImageElement>('.cover-link img');
        const list=frames.get(card)||[];
        if(img&&list[0]&&img.src!==list[0])img.src=list[0];
        positions.set(card,0);
      }
    }
  },{threshold:[0,0.6,1]});
  for(const card of cards)observer.observe(card);
  // Only cards actually on-screen advance; no fake recordings or heavy autoplay downloads.
  window.setInterval(()=>{
    if(document.hidden)return;
    for(const card of visible){
      const shots=frames.get(card)||[];
      const img=card.querySelector<HTMLImageElement>('.cover-link img');
      if(!img||shots.length<3)continue;
      const index=((positions.get(card)||0)+1)%shots.length;
      positions.set(card,index);img.src=shots[index];
    }
  },2100);
  const videoObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){
      const video=entry.target as HTMLVideoElement;
      if(entry.isIntersecting&&video.closest('details')?.open){
        video.play().catch(()=>{});
      }else video.pause();
    }
  },{threshold:0.65});
  document.querySelectorAll<HTMLVideoElement>('video[data-scroll-video]').forEach(video=>videoObserver.observe(video));
}

setupBrowse();setupSaved();setupScreens();setupScrollPreviews();renderSaved();

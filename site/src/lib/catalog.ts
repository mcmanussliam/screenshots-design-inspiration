import catalog from '../data/catalog.json';

export interface TagGroups {
  screen:string[]; element:string[]; flow:string[]; style:string[]; unreviewed:string[];
}
export interface Screenshot {
  name:string;url:string;format:string;sizeBytes:number|null;
  width:number|null;height:number|null;aspectRatio:number|null;
  orientation:'portrait'|'landscape'|'square'|'unknown';
  tags:string[];rawTags:string[];tagGroups:TagGroups;
}
export interface Recording {name:string;url:string;format:string;sizeBytes:number|null}
export interface Product {
  id:string;name:string;slug:string;platform:string;kind:'app'|'site';path:string;
  category:string;description:string;domain:string;
  tags:string[];tagGroups:TagGroups;screenshots:Screenshot[];videos:Recording[];
}
export const products=(catalog as {products:Product[]}).products;
export const allTags=[...new Set(products.flatMap(p=>[...p.tags,...p.screenshots.flatMap(s=>s.tags)]))].sort();
export const base=(path='')=>import.meta.env.BASE_URL.replace(/\/$/,'')+'/'+path.replace(/^\/+/,'');
export const productUrl=(p:Product)=>base(p.path+'/');
export const platformName=(p:string)=>({ios:'iOS',android:'Android',web:'Web',email:'Email',marketing:'Marketing'} as Record<string,string>)[p]||p;
export const formatBytes=(n:number|null|undefined)=>{
  if(n==null)return '';
  if(n<1024)return n+' B';
  if(n<1024*1024)return (n/1024).toFixed(n<10240?1:0)+' KB';
  return (n/(1024*1024)).toFixed(1)+' MB';
};

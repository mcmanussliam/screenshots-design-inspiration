import catalog from '../data/catalog.json';
export interface Screenshot { name:string; tags:string[]; url:string }
export interface Product { id:string; name:string; slug:string; platform:string; kind:'app'|'site'; path:string; category:string; tags:string[]; screenshots:Screenshot[] }
export const products = (catalog as {products:Product[]}).products;
export const allTags = [...new Set(products.flatMap(p=>[...p.tags,...p.screenshots.flatMap(s=>s.tags)]))].sort();
export const base = (path='') => import.meta.env.BASE_URL.replace(/\/$/,'') + '/' + path.replace(/^\/+/, '');
export const productUrl = (p:Product) => base(p.path+'/');
export const platformName = (p:string) => ({ios:'iOS',android:'Android',web:'Web',email:'Email',marketing:'Marketing'} as Record<string,string>)[p] || p;

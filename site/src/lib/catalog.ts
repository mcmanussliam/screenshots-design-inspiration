import catalog from '../data/catalog.json';

export interface TagGroups {
  screen:string[]; element:string[]; flow:string[]; pattern:string[]; style:string[]; unreviewed:string[];
}
export interface Screenshot {
  name:string;url:string;format:string;sizeBytes:number|null;
  width:number|null;height:number|null;aspectRatio:number|null;
  orientation:'portrait'|'landscape'|'square'|'unknown';
  tags:string[];rawTags:string[];tagGroups:TagGroups;
  reviewStatus:'source-documented'|'legacy-unverified';
  sourceUrl:string|null;capturedAt:string|null;
}
export interface Recording {name:string;url:string;format:string;sizeBytes:number|null}
export interface Product {
  id:string;name:string;slug:string;platform:string;kind:'app'|'site';path:string;
  category:string;description:string;domain:string;
  tags:string[];tagGroups:TagGroups;screenshots:Screenshot[];videos:Recording[];
  source:{page:string|null;owner:string|null;license:string|null;licenseUrl:string|null;licenseEvidence:string|null;credit:string|null;method:string|null;captureDate:string|null}|null;
}
export const products=(catalog as {products:Product[]}).products;
export function galleryScreens(product: Product): Screenshot[] {
  if (product.kind !== 'app') return product.screenshots;
  return product.screenshots.filter(({width, height}) => {
    if (!width || !height) return true;
    const ratio = width / height;
    return ratio >= 0.4 && ratio <= 0.67;
  });
}
export const browseProducts=products.filter(product => product.kind !== 'app' || galleryScreens(product).length > 0);
export const allTags=[...new Set(browseProducts.flatMap(p=>[...p.tags,...galleryScreens(p).flatMap(s=>s.tags)]))].sort();
export const base=(path='')=>import.meta.env.BASE_URL.replace(/\/$/,'')+'/'+path.replace(/^\/+/,'');
export const productUrl=(p:Product)=>base(p.path+'/');
export const platformName=(p:string)=>({ios:'iOS',android:'Android',web:'Web',email:'Email',marketing:'Marketing'} as Record<string,string>)[p]||p;
export const formatBytes=(n:number|null|undefined)=>{
  if(n==null)return '';
  if(n<1024)return n+' B';
  if(n<1024*1024)return (n/1024).toFixed(n<10240?1:0)+' KB';
  return (n/(1024*1024)).toFixed(1)+' MB';
};

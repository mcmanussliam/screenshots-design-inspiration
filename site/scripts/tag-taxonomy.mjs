// Canonical, documented vocabulary. Every legacy term has a facet and definition.
// Unknown terms are retained as unreviewed until a human assigns meaning.
import vocabulary from '../../data/tag-vocabulary.json' with { type: 'json' };
const normalize = s => String(s).normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const list={
 screen:['Splash Screen','Search Results','Feed','Media Player','Subscription','Profile','Onboarding','Welcome','Settings','Chat','Cart','Payment','Form','404 Page','Product Page & Landing','Catalog Page','Blog','About','Careers','Contacts','Integration Page','Media Kit'],
 element:['Navigation Bar','Modal','Text Field','Card','Skeleton','Chip','Tab','Chart','Breadcrumb','Progress Indicator','Video','Image'],
 flow:['Onboarding Flow','Account Creation','Social Login','Checkout Flow','Payment Flow','Guided Tour','Filtering & Sorting','Editing Profile','Messaging Flow','Subscription Flow','Authentication Flow','Search Flow','Booking Flow','Upload Flow','Deleting Account','Resetting Password','Personalizing & Customizing','Adding to Cart','Uploading & Downloading'],
 pattern:['Testimonials','Reviews & Rating','Trial & Freemium','Activity & Notification Feed','Search & Filtering','Billing & Plans','Payment Method Selection','Checklist & To Do','Empty States','Responsive Layout','Progressive Disclosure','Bulk Actions','Multi-Step Form'],
 style:['Dark Mode','Light Mode','Masonry Layout','Pill Buttons','Sticky Header','Gradient Background','Flat UI','Minimalist Navigation','Responsive Design','Photography','Motion','Illustration','3D','Clean','Colorful','Minimal','Brutalist','Typography','Glassmorphism','Neumorphism','Grid Layout','Minimalist Sidebar']
};
export const buckets={screen:[],element:[],flow:[],pattern:[],style:[]};
const descriptions=new Map();
const register=(kind,label,description='')=>{
 if(!buckets[kind].some(x=>normalize(x)===normalize(label)))buckets[kind].push(label);
 if(description)descriptions.set(normalize(label),description);
};
for(const term of vocabulary.entries)register(term.type,term.label,term.description);
for(const [kind,labels] of Object.entries(list))for(const label of labels)register(kind,label);
const index=new Map();
for(const [kind,labels] of Object.entries(buckets))for(const label of labels){
 // Existing documented labels take priority over lower-confidence aliases.
 if(!index.has(normalize(label)))index.set(normalize(label),{bucket:kind,label});
}
const aliases={
 'log in':'Login','sign in':'Login','logging in':'Login',
 'sign up':'Signup','sign-up':'Signup',
 'create account':'Account Creation','creating account':'Account Creation',
 'creating an account':'Account Creation',
 'welcome & get started':'Welcome','welcome and get started':'Welcome',
 'profile':'My Account & Profile',
 'settings':'Settings & Preferences','settings and preferences':'Settings & Preferences',
 'my account and profile':'My Account & Profile',
 'dashboard screen':'Dashboard','home screen':'Home',
 'filter & sorting':'Filter & Sort','filtering & sorting':'Filter & Sort',
 'filtering and sorting':'Filter & Sort',
 'form input fields':'Text Field','text input':'Text Field','primary button':'Button',
 'dropdown':'Dropdown Menu','tags':'Chip','tag':'Chip',
 'mobile navigation':'Navigation Bar','navbar':'Navigation Bar',
 'onboarding tutorial':'Guided Tour & Tutorial','onboarding flow':'Onboarding Flow',
 'flat ui':'Flat UI','3d design':'3D','colourful':'Colorful',
 'minimalist':'Minimal','chat detail':'Chat Detail','user profile':'My Account & Profile',
 'product details':'Product Detail','article details':'Article Detail',
 'floating action buttons':'Floating Action Button',
 'screen capture':'Screenshots','sign in form':'Login'
};
const noise = new Set(['misc','other','untagged','unknown','n/a','na','none','screenshot','image','ui','design','screen']);
export function classifyTags(tags){
 const out={screen:[],element:[],flow:[],pattern:[],style:[],unreviewed:[]};
 const seen=new Set();
 for(const raw of Array.isArray(tags)?tags:[]){
  if(typeof raw!=='string'||!raw.trim())continue;
  const original=raw.trim().slice(0,120),key=normalize(original);
  if(noise.has(key))continue; // Generic legacy labels have no search value.
  const canonical=aliases[key]||original;
  const match=index.get(normalize(canonical));
  const bucket=match?.bucket||'unreviewed',label=match?.label||original;
  const id=bucket+':'+normalize(label);
  if(!seen.has(id)){out[bucket].push(label);seen.add(id);}
 }
 return out;
}
export const groupedTags=tags=>{
 const groups=classifyTags(tags);
 return [...groups.screen,...groups.element,...groups.flow,...groups.pattern,...groups.style,...groups.unreviewed];
};
export const taxonomy=buckets;
export const tagDescription=label=>descriptions.get(normalize(label))||null;

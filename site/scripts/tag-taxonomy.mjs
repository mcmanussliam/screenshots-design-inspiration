// Canonical vocabulary for independently tagged UI references.
// Preserve unfamiliar labels as 'unreviewed', not as invented screen types.
const buckets = {
  screen: [
    'Login','Signup','Onboarding','Home','Dashboard','Notifications','Search',
    'Search Results','Settings','Profile','Account Setup','Permission','Checkout',
    'Cart','Payment','Product Detail','Article Detail','Chat','Messaging',
    'Calendar','Browse & Discover','Filter & Sort','Empty State','Error',
    'Subscription','Pricing','Help & Support','Welcome','Loading','Splash Screen',
    'Order Confirmation','Map','Feed','Media Player','Upload','Create',
    'Detail','Form'
  ],
  element: [
    'Text Field','Button','Card','Badge','Avatar','Tooltip','Toast','Checkbox',
    'Dialog','Dropdown Menu','Bottom Sheet','Stacked List','Banner','Side Navigation',
    'Top Navigation Bar','Tab','Table','Icon','Date Picker','Segmented Control',
    'Progress Indicator','Keyboard Key','Search Bar','Link','Tile','Divider',
    'Slider','Switch','Radio Button','Stepper','Modal','Accordion','Chip',
    'Carousel','Hero Image','Rating Control','Menu','Navigation Bar','Skeleton',
    'Floating Action Button','List','Pagination','Breadcrumb','Alert','Popover',
    'Toolbar','Video','Image','Chart'
  ],
  flow: [
    'Onboarding Flow','Account Creation','Social Login','Checkout Flow',
    'Payment Flow','Guided Tour','Filtering & Sorting','Editing Profile',
    'Messaging Flow','Subscription Flow','Authentication Flow','Search Flow',
    'Booking Flow','Upload Flow'
  ],
  style: [
    'Dark Mode','Light Mode','Masonry Layout','Pill Buttons','Sticky Header',
    'Gradient Background','Flat UI','Minimalist Navigation','Responsive Design',
    'Photography','Motion','Illustration','3D','Clean','Colorful','Minimal',
    'Brutalist','Typography','Glassmorphism','Neumorphism','Grid Layout',
    'Minimalist Sidebar'
  ]
};
const normalize = s => String(s).normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
const index = new Map();
for (const [bucket, labels] of Object.entries(buckets))
  for (const label of labels) index.set(normalize(label),{bucket,label});
const synonyms = {
  'log in':'Login', 'sign in':'Login','logging in':'Login',
  'sign up':'Signup','sign-up':'Signup','create account':'Account Creation',
  'creating account':'Account Creation','creating an account':'Account Creation',
  'welcome & get started':'Welcome','welcome and get started':'Welcome',
  'guided tour & tutorial':'Guided Tour','guided tour and tutorial':'Guided Tour',
  'filtering & sorting':'Filtering & Sorting','filter & sort':'Filter & Sort',
  'filtering and sorting':'Filtering & Sorting','profile & account':'Profile',
  'settings & preferences':'Settings','settings and preferences':'Settings',
  'my account & profile':'Profile','my account and profile':'Profile',
  'home screen':'Home','log in / sign up':'Login',
  'top navigation':'Top Navigation Bar','bottom sheet modal':'Bottom Sheet',
  'input':'Text Field','text input':'Text Field','primary button':'Button',
  'dropdown':'Dropdown Menu','tags':'Chip','tag':'Chip',
  'mobile navigation':'Navigation Bar','navbar':'Navigation Bar',
  'onboarding tutorial':'Onboarding Flow','onboarding flow':'Onboarding Flow',
  'flat ui':'Flat UI','3d design':'3D','colourful':'Colorful',
  'minimalist':'Minimal','chat detail':'Chat','user profile':'Profile',
  'product details':'Product Detail','article details':'Article Detail',
  'floating action buttons':'Floating Action Button'
};
export function classifyTags(tags) {
  const results = {screen:[],element:[],flow:[],style:[],unreviewed:[]};
  const seen = new Set();
  for (const raw of Array.isArray(tags) ? tags : []) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const value = raw.trim().slice(0,120);
    const record = index.get(normalize(synonyms[normalize(value)] || value));
    const bucket = record?.bucket || 'unreviewed';
    const label = record?.label || value;
    const key = bucket + ':' + normalize(label);
    if (!seen.has(key)) { results[bucket].push(label);seen.add(key); }
  }
  return results;
}
export const groupedTags = tags => {
  const groups = classifyTags(tags);
  return [...groups.screen,...groups.element,...groups.flow,...groups.style,...groups.unreviewed];
};
export const taxonomy = buckets;

const VISUALS = {
  food: { aliases: ['food', 'food-groceries', 'food-beverages', 'groceries'], home: '/images/categories/food-home.svg', hero: '/images/categories/food-hero.svg' },
  fashion: { aliases: ['fashion', 'fashion-clothing', 'clothing', 'fashion-clothing-apparel'], home: '/images/categories/fashion-home.svg', hero: '/images/categories/fashion-hero.svg' },
  electronics: { aliases: ['electronics', 'electronics-gadgets'], home: '/images/categories/electronics-home.svg', hero: '/images/categories/electronics-hero.svg' },
  health: { aliases: ['health', 'health-beauty', 'beauty', 'pharmacy'], home: '/images/categories/health-home.svg', hero: '/images/categories/health-hero.svg' },
  home: { aliases: ['home', 'home-living', 'home-living-decor'], home: '/images/categories/home-home.svg', hero: '/images/categories/home-hero.svg' },
  other: { aliases: ['other', 'services', 'phones-accessories', 'sports-fitness', 'books-stationery'], home: '/images/categories/other-home.svg', hero: '/images/categories/other-hero.svg' },
};

const normalize = (value = '') => value.toLowerCase().trim().replace(/&/g, 'and').replace(/[_\s]+/g, '-');

export function getCategoryVisual(category) {
  const key = normalize(typeof category === 'string' ? category : category?.slug || category?.name);
  for (const visual of Object.values(VISUALS)) {
    if (visual.aliases.some((alias) => { const a = normalize(alias); return key === a || key.startsWith(`${a}-`); })) return visual;
  }
  return VISUALS.other;
}

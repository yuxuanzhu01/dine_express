/**
 * DineExpress - Food & Restaurant Category Detector
 * Ensures the food safety badge is only shown for dining / food establishments.
 */

const FOOD_CATEGORY_KEYWORDS = [
  'restaurant', 'cafe', 'café', 'bakery', 'bar', 'pub', 'grill', 'bbq', 'barbecue',
  'pizza', 'pizzeria', 'taco', 'taqueria', 'sushi', 'ramen', 'noodle', 'diner',
  'bistro', 'buffet', 'ice cream', 'frozen yogurt', 'coffee', 'tea', 'boba',
  'bubble tea', 'dessert', 'deli', 'delicatessen', 'sandwich', 'fast food',
  'seafood', 'steak', 'steakhouse', 'brewery', 'winery', 'gastropub', 'lounge',
  'cantina', 'food court', 'food truck', 'eatery', 'kitchen', 'pot', 'hot pot',
  'cantonese', 'sichuan', 'dim sum', 'chinese', 'korean', 'japanese', 'mexican',
  'italian', 'thai', 'vietnamese', 'indian', 'american', 'mediterranean', 'greek',
  'french', 'spanish', 'persian', 'ethiopian', 'caribbean', 'hawaiian', 'poke',
  'donut', 'doughnut', 'bagel', 'burger', 'hamburger', 'wings', 'chicken',
  'creperie', 'brunch', 'breakfast', 'caterer', 'catering', 'supermarket', 'grocery'
];

/**
 * Checks whether a Google Maps place is a restaurant or food-related establishment
 * @param {{ category?: string, name?: string }} placeInfo
 * @param {Document} doc
 * @returns {boolean}
 */
export function isFoodEstablishment(placeInfo, doc = document) {
  // 1. Check place category text
  const category = (placeInfo?.category || '').toLowerCase();
  if (category) {
    if (FOOD_CATEGORY_KEYWORDS.some(kw => category.includes(kw))) {
      return true;
    }
  }

  // 2. Check DOM for food-specific features on the Google Maps page
  // A. "Menu" tab in navigation
  const menuTab = doc.querySelector('button[aria-label*="Menu"], button[aria-label*="menu"], div[aria-label*="Menu"], [data-tab-index="1"]');
  if (menuTab && /menu/i.test(menuTab.textContent || '')) {
    return true;
  }

  // B. "Order online" or "Order food" action button
  const orderBtn = doc.querySelector('button[aria-label*="Order"], a[aria-label*="Order"], button[data-value*="order"], [data-item-id*="order"]');
  if (orderBtn && /order/i.test(orderBtn.textContent || '')) {
    return true;
  }

  // C. Food service tags: "Dine-in", "Takeout", "Delivery", "No delivery"
  const serviceOptions = doc.querySelectorAll('div.E02Zkc, div.LTs0Rc, div.fontBodyMedium, span');
  for (const el of serviceOptions) {
    const txt = (el.textContent || '').toLowerCase();
    if (txt.includes('dine-in') || txt.includes('takeout') || txt.includes('delivery')) {
      return true;
    }
  }

  // 3. Fallback: check place name for strong food signals
  const name = (placeInfo?.name || '').toLowerCase();
  const strongNameWords = ['restaurant', 'wok', 'kitchen', 'bakery', 'cafe', 'café', 'grill', 'bistro', 'ramen', 'sushi', 'pizza', 'taqueria', 'bbq', 'coffee', 'eats', 'diner', 'bar & grill', 'seafood', 'hotpot', 'hot pot', 'noodle'];
  if (strongNameWords.some(w => name.includes(w))) {
    return true;
  }

  return false;
}

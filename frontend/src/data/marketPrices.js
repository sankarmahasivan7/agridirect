/**
 * Current Agricultural Mandi & APMC Market Prices
 * Includes regional market rates (Koyambedu, Madurai Central, Coimbatore MGR, etc.)
 * with fuzzy matching and alias resolution (handles typos like 'totatoe', 'patato', etc.)
 */

export const MARKET_PRICES = [
  {
    id: 'tomato',
    name: 'Tomato',
    nameTa: 'தக்காளி',
    category: 'Vegetables',
    categoryTa: 'காய்கறிகள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 28.00,
    minPrice: 24.00,
    maxPrice: 33.00,
    trend: 'up',
    trendPercent: '+5.2%',
    primaryMandi: 'Koyambedu Wholesale Market, Chennai',
    primaryMandiTa: 'கோயம்பேடு மொத்த சந்தை, சென்னை',
    arrivals: '450 Quintals/day',
    shelfLifeDays: 5,
    isPerishable: true,
    aliases: ['totatoe', 'tomato', 'tomatoes', 'tamato', 'tamator', 'thakkali', 'தக்காளி', 'desi tomato', 'hybrid tomato'],
    icon: '🍅'
  },
  {
    id: 'potato',
    name: 'Potato',
    nameTa: 'உருளைக்கிழங்கு',
    category: 'Vegetables',
    categoryTa: 'காய்கறிகள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 26.00,
    minPrice: 22.00,
    maxPrice: 30.00,
    trend: 'stable',
    trendPercent: '0.0%',
    primaryMandi: 'MGR Wholesale Market, Coimbatore',
    primaryMandiTa: 'எம்.ஜி.ஆர் மொத்த சந்தை, கோயம்புத்தூர்',
    arrivals: '620 Quintals/day',
    shelfLifeDays: 20,
    isPerishable: false,
    aliases: ['potato', 'potatoes', 'patato', 'aaloo', 'alu', 'urulaikizhangu', 'urulai', 'உருளைக்கிழங்கு', 'kodaikanal potato'],
    icon: '🥔'
  },
  {
    id: 'onion',
    name: 'Onion (Bellary / Big)',
    nameTa: 'வெங்காயம் (பெரியது)',
    category: 'Vegetables',
    categoryTa: 'காய்கறிகள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 34.00,
    minPrice: 30.00,
    maxPrice: 39.00,
    trend: 'up',
    trendPercent: '+3.8%',
    primaryMandi: 'Central Market, Madurai',
    primaryMandiTa: 'மத்திய சந்தை, மதுரை',
    arrivals: '850 Quintals/day',
    shelfLifeDays: 30,
    isPerishable: false,
    aliases: ['onion', 'onions', 'onoin', 'onionn', 'pyaz', 'vengayam', 'வெங்காயம்', 'bellary onion'],
    icon: '🧅'
  },
  {
    id: 'shallot',
    name: 'Small Onion (Shallots)',
    nameTa: 'சின்ன வெங்காயம் (சாம்பார்)',
    category: 'Vegetables',
    categoryTa: 'காய்கறிகள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 58.00,
    minPrice: 50.00,
    maxPrice: 65.00,
    trend: 'down',
    trendPercent: '-4.2%',
    primaryMandi: 'Gandhi Market, Trichy',
    primaryMandiTa: 'காந்தி சந்தை, திருச்சி',
    arrivals: '310 Quintals/day',
    shelfLifeDays: 25,
    isPerishable: false,
    aliases: ['shallots', 'small onion', 'sambar onion', 'chinna vengayam', 'சின்ன வெங்காயம்'],
    icon: '🧅'
  },
  {
    id: 'carrot',
    name: 'Carrot (Ooty Organic)',
    nameTa: 'கேரட் (ஊட்டி)',
    category: 'Vegetables',
    categoryTa: 'காய்கறிகள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 42.00,
    minPrice: 36.00,
    maxPrice: 48.00,
    trend: 'up',
    trendPercent: '+6.1%',
    primaryMandi: 'Uzhavar Sandhai, Salem',
    primaryMandiTa: 'உழவர் சந்தை, சேலம்',
    arrivals: '280 Quintals/day',
    shelfLifeDays: 10,
    isPerishable: true,
    aliases: ['carrot', 'carrots', 'carrotte', 'gajar', 'kerat', 'கேரட்', 'ooty carrot'],
    icon: '🥕'
  },
  {
    id: 'brinjal',
    name: 'Brinjal / Eggplant',
    nameTa: 'கத்தரிக்காய்',
    category: 'Vegetables',
    categoryTa: 'காய்கறிகள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 24.00,
    minPrice: 20.00,
    maxPrice: 28.00,
    trend: 'down',
    trendPercent: '-3.5%',
    primaryMandi: 'Nainarkoil APMC, Ramanathapuram',
    primaryMandiTa: 'நயினார்கோவில் சந்தை, ராமநாதபுரம்',
    arrivals: '190 Quintals/day',
    shelfLifeDays: 6,
    isPerishable: true,
    aliases: ['brinjal', 'eggplant', 'aubergine', 'baingan', 'kathirikai', 'கத்தரிக்காய்', 'green brinjal', 'purple brinjal'],
    icon: '🍆'
  },
  {
    id: 'green_chilli',
    name: 'Green Chilli',
    nameTa: 'பச்சை மிளகாய்',
    category: 'Vegetables',
    categoryTa: 'காய்கறிகள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 45.00,
    minPrice: 38.00,
    maxPrice: 52.00,
    trend: 'up',
    trendPercent: '+7.4%',
    primaryMandi: 'Koyambedu Wholesale Market, Chennai',
    primaryMandiTa: 'கோயம்பேடு மொத்த சந்தை, சென்னை',
    arrivals: '140 Quintals/day',
    shelfLifeDays: 8,
    isPerishable: true,
    aliases: ['chilli', 'green chilli', 'chilly', 'mirchi', 'pachai milagai', 'பச்சை மிளகாய்', 'g4 chilli'],
    icon: '🌶️'
  },
  {
    id: 'cabbage',
    name: 'Cabbage',
    nameTa: 'முட்டைக்கோஸ்',
    category: 'Vegetables',
    categoryTa: 'காய்கறிகள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 18.00,
    minPrice: 15.00,
    maxPrice: 22.00,
    trend: 'stable',
    trendPercent: '+0.5%',
    primaryMandi: 'MGR Wholesale Market, Coimbatore',
    primaryMandiTa: 'எம்.ஜி.ஆர் மொத்த சந்தை, கோயம்புத்தூர்',
    arrivals: '410 Quintals/day',
    shelfLifeDays: 12,
    isPerishable: true,
    aliases: ['cabbage', 'cabbages', 'patta gobhi', 'muttaikose', 'முட்டைக்கோஸ்'],
    icon: '🥬'
  },
  {
    id: 'cauliflower',
    name: 'Cauliflower',
    nameTa: 'காலிஃபிளவர்',
    category: 'Vegetables',
    categoryTa: 'காய்கறிகள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 32.00,
    minPrice: 26.00,
    maxPrice: 38.00,
    trend: 'down',
    trendPercent: '-2.8%',
    primaryMandi: 'Central Market, Madurai',
    primaryMandiTa: 'மத்திய சந்தை, மதுரை',
    arrivals: '210 Quintals/day',
    shelfLifeDays: 6,
    isPerishable: true,
    aliases: ['cauliflower', 'gobi', 'phool gobhi', 'poocopy', 'காலிஃபிளவர்'],
    icon: '🥦'
  },
  {
    id: 'okra',
    name: "Lady's Finger / Okra",
    nameTa: 'வெண்டைக்காய்',
    category: 'Vegetables',
    categoryTa: 'காய்கறிகள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 30.00,
    minPrice: 25.00,
    maxPrice: 35.00,
    trend: 'stable',
    trendPercent: '+1.1%',
    primaryMandi: 'Uzhavar Sandhai, Tirunelveli',
    primaryMandiTa: 'உழவர் சந்தை, திருநெல்வேலி',
    arrivals: '160 Quintals/day',
    shelfLifeDays: 5,
    isPerishable: true,
    aliases: ['okra', 'ladies finger', 'lady finger', 'bhindi', 'vendaikkai', 'வெண்டைக்காய்'],
    icon: '🌱'
  },
  {
    id: 'drumstick',
    name: 'Drumstick (Moringa)',
    nameTa: 'முருங்கைக்காய்',
    category: 'Vegetables',
    categoryTa: 'காய்கறிகள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 48.00,
    minPrice: 40.00,
    maxPrice: 56.00,
    trend: 'up',
    trendPercent: '+8.0%',
    primaryMandi: 'Gandhi Market, Dindigul',
    primaryMandiTa: 'காந்தி சந்தை, திண்டுக்கல்',
    arrivals: '95 Quintals/day',
    shelfLifeDays: 7,
    isPerishable: true,
    aliases: ['drumstick', 'moringa', 'shevga', 'murungakkai', 'முருங்கைக்காய்'],
    icon: '🥢'
  },
  {
    id: 'capsicum',
    name: 'Capsicum / Bell Pepper',
    nameTa: 'குடைமிளகாய்',
    category: 'Vegetables',
    categoryTa: 'காய்கறிகள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 55.00,
    minPrice: 48.00,
    maxPrice: 62.00,
    trend: 'stable',
    trendPercent: '-0.5%',
    primaryMandi: 'Koyambedu Wholesale Market, Chennai',
    primaryMandiTa: 'கோயம்பேடு மொத்த சந்தை, சென்னை',
    arrivals: '110 Quintals/day',
    shelfLifeDays: 8,
    isPerishable: true,
    aliases: ['capsicum', 'bell pepper', 'shimla mirch', 'kudaimilagai', 'குடைமிளகாய்'],
    icon: '🫑'
  },
  {
    id: 'ginger',
    name: 'Fresh Ginger',
    nameTa: 'இஞ்சி',
    category: 'Spices',
    categoryTa: 'மசாலா & மூலிகைகள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 95.00,
    minPrice: 85.00,
    maxPrice: 110.00,
    trend: 'up',
    trendPercent: '+4.9%',
    primaryMandi: 'Koyambedu Wholesale Market, Chennai',
    primaryMandiTa: 'கோயம்பேடு மொத்த சந்தை, சென்னை',
    arrivals: '80 Quintals/day',
    shelfLifeDays: 25,
    isPerishable: false,
    aliases: ['ginger', 'adrak', 'inji', 'இஞ்சி', 'fresh ginger'],
    icon: '🫚'
  },
  {
    id: 'garlic',
    name: 'Garlic (Desi)',
    nameTa: 'பூண்டு',
    category: 'Spices',
    categoryTa: 'மசாலா & மூலிகைகள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 140.00,
    minPrice: 125.00,
    maxPrice: 160.00,
    trend: 'stable',
    trendPercent: '+1.2%',
    primaryMandi: 'Uzhavar Sandhai, Salem',
    primaryMandiTa: 'உழவர் சந்தை, சேலம்',
    arrivals: '120 Quintals/day',
    shelfLifeDays: 45,
    isPerishable: false,
    aliases: ['garlic', 'lahsun', 'poondu', 'பூண்டு'],
    icon: '🧄'
  },
  {
    id: 'banana',
    name: 'Banana (Poovan / Robusta)',
    nameTa: 'வாழைப்பழம் (பூவன்)',
    category: 'Fruits',
    categoryTa: 'பழங்கள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 35.00,
    minPrice: 30.00,
    maxPrice: 42.00,
    trend: 'stable',
    trendPercent: '-1.0%',
    primaryMandi: 'Gandhi Market, Trichy',
    primaryMandiTa: 'காந்தி சந்தை, திருச்சி',
    arrivals: '540 Quintals/day',
    shelfLifeDays: 5,
    isPerishable: true,
    aliases: ['banana', 'bananas', 'kela', 'vazhaipazham', 'வாழைப்பழம்', 'poovan', 'robusta'],
    icon: '🍌'
  },
  {
    id: 'mango',
    name: 'Mango (Alphonso / Banganapalli)',
    nameTa: 'மாம்பழம் (பங்கனப்பள்ளி)',
    category: 'Fruits',
    categoryTa: 'பழங்கள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 75.00,
    minPrice: 65.00,
    maxPrice: 90.00,
    trend: 'up',
    trendPercent: '+9.2%',
    primaryMandi: 'Dharmapuri Fruit Mandi',
    primaryMandiTa: 'தருமபுரி பழ சந்தை',
    arrivals: '350 Quintals/day',
    shelfLifeDays: 6,
    isPerishable: true,
    aliases: ['mango', 'mangoes', 'aam', 'mambazham', 'மாம்பழம்', 'alphonso', 'banganapalli'],
    icon: '🥭'
  },
  {
    id: 'rice_ponni',
    name: 'Rice (Raw Ponni)',
    nameTa: 'பொன்னி அரிசி',
    category: 'Grains',
    categoryTa: 'தானியங்கள் & பயிர்கள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 52.00,
    minPrice: 48.00,
    maxPrice: 58.00,
    trend: 'stable',
    trendPercent: '+0.2%',
    primaryMandi: 'Thanjavur Grain Regulated Market',
    primaryMandiTa: 'தஞ்சாவூர் தானிய ஒழுங்குமுறை விற்பனைக்கூடம்',
    arrivals: '1200 Quintals/day',
    shelfLifeDays: 180,
    isPerishable: false,
    aliases: ['rice', 'ponni rice', 'chawal', 'arisi', 'அரிசி', 'raw rice', 'boiled rice'],
    icon: '🌾'
  },
  {
    id: 'wheat',
    name: 'Wheat (Sharbati)',
    nameTa: 'கோதுமை',
    category: 'Grains',
    categoryTa: 'தானியங்கள் & பயிர்கள்',
    unit: 'kg',
    unitTa: 'கிலோ',
    modalPrice: 38.00,
    minPrice: 34.00,
    maxPrice: 42.00,
    trend: 'down',
    trendPercent: '-1.5%',
    primaryMandi: 'Madurai Regulated Market',
    primaryMandiTa: 'மதுரை ஒழுங்குமுறை விற்பனைக்கூடம்',
    arrivals: '780 Quintals/day',
    shelfLifeDays: 180,
    isPerishable: false,
    aliases: ['wheat', 'gehu', 'godhumai', 'கோதுமை'],
    icon: '🌾'
  }
]

/**
 * Normalizes strings by lowercasing and stripping non-alphanumeric chars
 */
function cleanStr(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]/g, '')
}

/**
 * Smart fuzzy matching to find a crop by name or common misspelling
 * e.g. "totatoe" -> matches Tomato
 */
export function findMarketPrice(query) {
  if (!query || typeof query !== 'string') return null
  const cleaned = cleanStr(query)
  if (cleaned.length < 2) return null

  // 1. Direct exact alias or name match
  for (const item of MARKET_PRICES) {
    if (cleanStr(item.name) === cleaned || cleanStr(item.nameTa) === cleaned) {
      return item
    }
    for (const alias of item.aliases) {
      if (cleanStr(alias) === cleaned) {
        return item
      }
    }
  }

  // 2. Substring or prefix match
  for (const item of MARKET_PRICES) {
    for (const alias of item.aliases) {
      const cAlias = cleanStr(alias)
      if (cleaned.includes(cAlias) || cAlias.includes(cleaned)) {
        return item
      }
    }
  }

  // 3. Typo fuzzy distance (Levenshtein-like check for typos like "totatoe" -> "tomato")
  let bestMatch = null
  let bestScore = 999

  for (const item of MARKET_PRICES) {
    for (const alias of item.aliases) {
      const cAlias = cleanStr(alias)
      // If lengths are close
      if (Math.abs(cleaned.length - cAlias.length) <= 2) {
        let diff = 0
        const minLen = Math.min(cleaned.length, cAlias.length)
        for (let i = 0; i < minLen; i++) {
          if (cleaned[i] !== cAlias[i]) diff++
        }
        diff += Math.abs(cleaned.length - cAlias.length)
        if (diff <= 2 && diff < bestScore) {
          bestScore = diff
          bestMatch = item
        }
      }
    }
  }

  return bestMatch
}

/**
 * Returns list of popular quick-pick crops
 */
export const POPULAR_CROPS = [
  { name: 'Tomato', nameTa: 'தக்காளி', icon: '🍅' },
  { name: 'Potato', nameTa: 'உருளைக்கிழங்கு', icon: '🥔' },
  { name: 'Onion', nameTa: 'வெங்காயம்', icon: '🧅' },
  { name: 'Carrot', nameTa: 'கேரட்', icon: '🥕' },
  { name: 'Brinjal', nameTa: 'கத்தரிக்காய்', icon: '🍆' },
  { name: 'Green Chilli', nameTa: 'பச்சை மிளகாய்', icon: '🌶️' },
  { name: 'Cabbage', nameTa: 'முட்டைக்கோஸ்', icon: '🥬' },
  { name: 'Lady Finger', nameTa: 'வெண்டைக்காய்', icon: '🌱' },
  { name: 'Banana', nameTa: 'வாழைப்பழம்', icon: '🍌' },
  { name: 'Rice', nameTa: 'அரிசி', icon: '🌾' },
]

export const MANDI_LOCATIONS = [
  'All Mandis',
  'Koyambedu Wholesale Market, Chennai',
  'Central Market, Madurai',
  'MGR Wholesale Market, Coimbatore',
  'Uzhavar Sandhai, Salem',
  'Gandhi Market, Trichy',
  'Uzhavar Sandhai, Tirunelveli',
  'Dharmapuri Fruit Mandi',
  'Thanjavur Grain Regulated Market'
]

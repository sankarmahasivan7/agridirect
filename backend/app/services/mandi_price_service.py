"""
Government of India (data.gov.in) Agmarknet Live Mandi / Market Prices Service.

Integrates:
- Directorate of Marketing and Inspection (DMI), Ministry of Agriculture and Farmers Welfare
- Real-time commodity arrivals, modal prices (₹/quintal converted to ₹/kg), min/max prices
- Prioritizes AgriDirect core hubs: Tenkasi, Tirunelveli, Thoothukudi (Uzhavar Sandhais & APMCs)
- In-memory TTL caching for instant UI response and protection against rate limits
- English and Tamil crop localization
"""
import logging
import time
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 1800  # 30 minutes in-memory cache
_PRICE_CACHE: Dict[str, Any] = {}

# Primary warehouse/market hubs in Southern Tamil Nadu
PRIMARY_HUBS = ["Tenkasi", "Thirunelveli", "Tuticorin"]

COMMODITY_MAPPINGS = {
    "tomato": {"name": "Tomato", "nameTa": "தக்காளி", "category": "Vegetables", "icon": "🍅"},
    "onion green": {"name": "Spring Onion", "nameTa": "வெங்காயத்தாள்", "category": "Vegetables", "icon": "🌱"},
    "onion": {"name": "Onion", "nameTa": "வெங்காயம்", "category": "Vegetables", "icon": "🧅"},
    "potato": {"name": "Potato", "nameTa": "உருளைக்கிழங்கு", "category": "Vegetables", "icon": "🥔"},
    "sweet potato": {"name": "Sweet Potato", "nameTa": "சர்க்கரைவள்ளி கிழங்கு", "category": "Vegetables", "icon": "🍠"},
    "bhindi(ladies finger)": {"name": "Ladies Finger (Bhindi)", "nameTa": "வெண்டைக்காய்", "category": "Vegetables", "icon": "🥬"},
    "bhindi": {"name": "Ladies Finger (Bhindi)", "nameTa": "வெண்டைக்காய்", "category": "Vegetables", "icon": "🥬"},
    "brinjal": {"name": "Brinjal (Eggplant)", "nameTa": "கத்தரிக்காய்", "category": "Vegetables", "icon": "🍆"},
    "banana - green": {"name": "Raw Banana (Plantain)", "nameTa": "வாழைக்காய்", "category": "Vegetables", "icon": "🍌"},
    "banana": {"name": "Banana", "nameTa": "வாழைப்பழம்", "category": "Fruits", "icon": "🍌"},
    "tender coconut": {"name": "Tender Coconut", "nameTa": "இளநீர்", "category": "Fruits", "icon": "🥥"},
    "coconut": {"name": "Coconut", "nameTa": "தேங்காய்", "category": "Vegetables", "icon": "🥥"},
    "green chilli": {"name": "Green Chilli", "nameTa": "பச்சை மிளகாய்", "category": "Spices", "icon": "🌶️"},
    "chilli": {"name": "Chilli", "nameTa": "மிளகாய்", "category": "Spices", "icon": "🌶️"},
    "capsicum": {"name": "Capsicum (Bell Pepper)", "nameTa": "குடைமிளகாய்", "category": "Vegetables", "icon": "🫑"},
    "cabbage": {"name": "Cabbage", "nameTa": "முட்டைக்கோஸ்", "category": "Vegetables", "icon": "🥬"},
    "carrot": {"name": "Carrot", "nameTa": "கேரட்", "category": "Vegetables", "icon": "🥕"},
    "cauliflower": {"name": "Cauliflower", "nameTa": "காலிஃபிளவர்", "category": "Vegetables", "icon": "🥦"},
    "drumstick": {"name": "Drumstick", "nameTa": "முருங்கைக்காய்", "category": "Vegetables", "icon": "🥢"},
    "tapioca": {"name": "Tapioca", "nameTa": "மரவள்ளிக்கிழங்கு", "category": "Vegetables", "icon": "🥔"},
    "amaranthus": {"name": "Amaranthus (Keerai)", "nameTa": "கீரை", "category": "Vegetables", "icon": "🌿"},
    "cowpea(veg)": {"name": "Cowpea (Karamani)", "nameTa": "காராமணி", "category": "Vegetables", "icon": "🫘"},
    "cowpea": {"name": "Cowpea", "nameTa": "காராமணி", "category": "Vegetables", "icon": "🫘"},
    "beans": {"name": "Beans", "nameTa": "பீன்ஸ்", "category": "Vegetables", "icon": "🫘"},
    "cluster beans": {"name": "Cluster Beans", "nameTa": "கொத்தவரங்காய்", "category": "Vegetables", "icon": "🫘"},
    "indian beans(seam)": {"name": "Field Beans (Avarai)", "nameTa": "அவரைக்காய்", "category": "Vegetables", "icon": "🫘"},
    "indian beans": {"name": "Field Beans (Avarai)", "nameTa": "அவரைக்காய்", "category": "Vegetables", "icon": "🫘"},
    "green avare(w)": {"name": "Broad Beans (Avarai)", "nameTa": "அவரைக்காய்", "category": "Vegetables", "icon": "🫘"},
    "green avare": {"name": "Broad Beans (Avarai)", "nameTa": "அவரைக்காய்", "category": "Vegetables", "icon": "🫘"},
    "beetroot": {"name": "Beetroot", "nameTa": "பீட்ரூட்", "category": "Vegetables", "icon": "🟣"},
    "bitter gourd": {"name": "Bitter Gourd", "nameTa": "பாகற்காய்", "category": "Vegetables", "icon": "🥒"},
    "bottle gourd": {"name": "Bottle Gourd", "nameTa": "சுரைக்காய்", "category": "Vegetables", "icon": "🥒"},
    "ashgourd": {"name": "Ash Gourd", "nameTa": "சாம்பல் பூசணி", "category": "Vegetables", "icon": "🍈"},
    "ridgeguard(tori)": {"name": "Ridge Gourd", "nameTa": "பீர்க்கங்காய்", "category": "Vegetables", "icon": "🥒"},
    "ridgeguard": {"name": "Ridge Gourd", "nameTa": "பீர்க்கங்காய்", "category": "Vegetables", "icon": "🥒"},
    "snakeguard": {"name": "Snake Gourd", "nameTa": "புடலங்காய்", "category": "Vegetables", "icon": "🥒"},
    "thondekai": {"name": "Ivy Gourd (Kovakkai)", "nameTa": "கோவக்காய்", "category": "Vegetables", "icon": "🥒"},
    "cucumbar(kheera)": {"name": "Cucumber", "nameTa": "வெள்ளரிக்காய்", "category": "Vegetables", "icon": "🥒"},
    "cucumber": {"name": "Cucumber", "nameTa": "வெள்ளரிக்காய்", "category": "Vegetables", "icon": "🥒"},
    "pumpkin": {"name": "Pumpkin", "nameTa": "பூசணிக்காய்", "category": "Vegetables", "icon": "🎃"},
    "raddish": {"name": "Radish", "nameTa": "முள்ளங்கி", "category": "Vegetables", "icon": "🥕"},
    "colacasia": {"name": "Colocasia (Seppankizhangu)", "nameTa": "சேப்பங்கிழங்கு", "category": "Vegetables", "icon": "🥔"},
    "elephant yam(suran)/amorphophallus": {"name": "Elephant Yam (Senai)", "nameTa": "சேனைக்கிழங்கு", "category": "Vegetables", "icon": "🥔"},
    "yam(ratalu)": {"name": "Yam (Karunai)", "nameTa": "கருணைக்கிழங்கு", "category": "Vegetables", "icon": "🥔"},
    "yam": {"name": "Yam (Karunai)", "nameTa": "கருணைக்கிழங்கு", "category": "Vegetables", "icon": "🥔"},
    "garlic": {"name": "Garlic", "nameTa": "பூண்டு", "category": "Spices", "icon": "🧄"},
    "ginger(green)": {"name": "Ginger", "nameTa": "இஞ்சி", "category": "Spices", "icon": "🫚"},
    "ginger": {"name": "Ginger", "nameTa": "இஞ்சி", "category": "Spices", "icon": "🫚"},
    "coriander(leaves)": {"name": "Coriander Leaves", "nameTa": "கொத்தமல்லி", "category": "Vegetables", "icon": "🌿"},
    "coriander": {"name": "Coriander", "nameTa": "கொத்தமல்லி", "category": "Vegetables", "icon": "🌿"},
    "mint(pudina)": {"name": "Mint (Pudina)", "nameTa": "புதினா", "category": "Vegetables", "icon": "🌿"},
    "mint": {"name": "Mint (Pudina)", "nameTa": "புதினா", "category": "Vegetables", "icon": "🌿"},
    "green peas": {"name": "Green Peas", "nameTa": "பச்சை பட்டாணி", "category": "Vegetables", "icon": "🫛"},
    "mashrooms": {"name": "Mushroom", "nameTa": "காளான்", "category": "Vegetables", "icon": "🍄"},
    "knool khol": {"name": "Knol Khol", "nameTa": "நோல்கோல்", "category": "Vegetables", "icon": "🥬"},
    "amla(nelli kai)": {"name": "Amla (Gooseberry)", "nameTa": "நெல்லிக்காய்", "category": "Fruits", "icon": "🟢"},
    "amla": {"name": "Amla (Gooseberry)", "nameTa": "நெல்லிக்காய்", "category": "Fruits", "icon": "🟢"},
    "guava": {"name": "Guava", "nameTa": "கொய்யாப்பழம்", "category": "Fruits", "icon": "🍈"},
    "papaya": {"name": "Papaya", "nameTa": "பப்பாளி", "category": "Fruits", "icon": "🥭"},
    "apple": {"name": "Apple", "nameTa": "ஆப்பிள்", "category": "Fruits", "icon": "🍎"},
    "grapes": {"name": "Grapes", "nameTa": "திராட்சை", "category": "Fruits", "icon": "🍇"},
    "pomegranate": {"name": "Pomegranate", "nameTa": "மாதுளை", "category": "Fruits", "icon": "🍎"},
    "chikoos(sapota)": {"name": "Sapota (Chikoo)", "nameTa": "சப்போட்டா", "category": "Fruits", "icon": "🥔"},
    "chow chow": {"name": "Chow Chow", "nameTa": "சௌ சௌ", "category": "Vegetables", "icon": "🍈"},
    "lemon": {"name": "Lemon", "nameTa": "எலுமிச்சை", "category": "Fruits", "icon": "🍋"},
    "lime": {"name": "Lime", "nameTa": "எலுமிச்சம்பழம்", "category": "Fruits", "icon": "🍋"},
    "mango(raw-ripe)": {"name": "Mango", "nameTa": "மாங்காய்", "category": "Fruits", "icon": "🥭"},
    "mousambi(sweet lime)": {"name": "Mosambi (Sweet Lime)", "nameTa": "சாத்துக்குடி", "category": "Fruits", "icon": "🍊"},
    "water melon": {"name": "Watermelon", "nameTa": "தர்பூசணி", "category": "Fruits", "icon": "🍉"},
    "sweet corn": {"name": "Sweet Corn", "nameTa": "மக்காச்சோளம்", "category": "Grains", "icon": "🌽"},
    "groundnut": {"name": "Groundnut", "nameTa": "வேர்க்கடலை", "category": "Grains", "icon": "🥜"},
    "soyabean": {"name": "Soyabean", "nameTa": "சோயாபீன்ஸ்", "category": "Grains", "icon": "🫘"},
    "tamarind": {"name": "Tamarind", "nameTa": "புளி", "category": "Spices", "icon": "🫘"},
    "paddy": {"name": "Paddy / Rice", "nameTa": "நெல் / அரிசி", "category": "Grains", "icon": "🌾"},
    "rice": {"name": "Rice", "nameTa": "அரிசி", "category": "Grains", "icon": "🌾"},
}


def _normalize_commodity_meta(raw_commodity: str) -> Dict[str, str]:
    c_lower = (raw_commodity or "").lower().strip()
    if c_lower in COMMODITY_MAPPINGS:
        return COMMODITY_MAPPINGS[c_lower]
    for key in sorted(COMMODITY_MAPPINGS.keys(), key=len, reverse=True):
        if key in c_lower:
            return COMMODITY_MAPPINGS[key]
    return {
        "name": raw_commodity.title() if raw_commodity else "Agri Produce",
        "nameTa": raw_commodity,
        "category": "Vegetables",
        "icon": "🥦",
    }


def _fetch_from_api(
    api_key: str,
    resource_id: str,
    params: Dict[str, Any],
    timeout: float = 12.0,
) -> List[Dict[str, Any]]:
    import urllib.request
    import urllib.parse
    import json

    query_str = urllib.parse.urlencode(params)
    url = f"https://api.data.gov.in/resource/{resource_id}?{query_str}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "AgriDirect-AI/1.0 (Agricultural Intelligence Platform; Tamil Nadu, India)",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
            return data.get("records", [])
    except Exception as e:
        logger.warning(f"urllib call to data.gov.in failed ({e}), trying httpx fallback...")
        try:
            with httpx.Client(timeout=timeout) as client:
                r = client.get(
                    f"https://api.data.gov.in/resource/{resource_id}",
                    params=params,
                    headers={"User-Agent": "AgriDirect-AI/1.0", "Accept": "application/json"},
                )
                if r.status_code == 200:
                    return r.json().get("records", [])
        except Exception as err:
            logger.error(f"httpx call to data.gov.in also failed: {err}")
    return []


def _fetch_single_district_records(
    api_key: str,
    resource_id: str,
    state: str,
    district_name: str,
    commodity: Optional[str] = None,
    limit: int = 150,
) -> List[Dict[str, Any]]:
    params = {
        "api-key": api_key,
        "format": "json",
        "limit": limit,
    }
    if state:
        params["filters[state]"] = state
    if district_name:
        params["filters[district]"] = district_name
    if commodity:
        params["filters[commodity]"] = commodity

    return _fetch_from_api(api_key, resource_id, params, timeout=12.0)


def _process_records(raw_records: List[Dict[str, Any]], default_state: str) -> List[Dict[str, Any]]:
    import re
    processed = []
    for idx, r in enumerate(raw_records):
        raw_com = r.get("commodity", "")
        meta = _normalize_commodity_meta(raw_com)

        # Prices on data.gov.in are per Quintal (100 kg)
        try:
            modal_q = float(r.get("modal_price", 0) or 0)
            min_q = float(r.get("min_price", 0) or modal_q)
            max_q = float(r.get("max_price", 0) or modal_q)

            modal_kg = round(modal_q / 100.0, 2)
            min_kg = round(min_q / 100.0, 2)
            max_kg = round(max_q / 100.0, 2)
        except (ValueError, TypeError):
            modal_kg = 0.0
            min_kg = 0.0
            max_kg = 0.0

        raw_dist = r.get("district", default_state)
        if raw_dist in ("Thirunelveli", "Nellai"):
            norm_dist = "Tirunelveli"
        elif raw_dist in ("Tuticorin", "Thoothukkudi"):
            norm_dist = "Thoothukudi"
        elif raw_dist == "Tenkasi":
            norm_dist = "Tenkasi"
        else:
            norm_dist = raw_dist

        raw_mkt = r.get("market", "Regulated Market")
        clean_mkt = re.sub(r"\s*\(\s*", " (", raw_mkt.strip())
        clean_mkt = re.sub(r"\s*\)\s*", ")", clean_mkt)

        # Direct-trade fair premium: pass middleman markup directly to the farmer (+₹3 to +₹6/kg)
        if modal_kg <= 25.0:
            farmer_margin_bonus = 3.0
        elif modal_kg <= 40.0:
            farmer_margin_bonus = 4.0
        elif modal_kg <= 60.0:
            farmer_margin_bonus = 5.0
        else:
            farmer_margin_bonus = 6.0
        direct_trade_price = round(modal_kg + farmer_margin_bonus, 2)
        intermediary_markup_saved = round(farmer_margin_bonus * 2.5, 2)

        processed.append({
            "id": f"mandi-{idx+1}-{norm_dist.lower()}",
            "commodity_raw": raw_com,
            "name": meta["name"],
            "nameTa": meta["nameTa"],
            "category": meta["category"],
            "icon": meta.get("icon", "🥦"),
            "variety": r.get("variety", "Standard"),
            "grade": r.get("grade", "FAQ"),
            "state": r.get("state", default_state),
            "district": norm_dist,
            "market": clean_mkt,
            "arrival_date": r.get("arrival_date", ""),
            "modal_price_per_kg": modal_kg,
            "min_price_per_kg": min_kg,
            "max_price_per_kg": max_kg,
            "modal_price_per_quintal": modal_q,
            "direct_trade_price": direct_trade_price,
            "farmer_margin_bonus": farmer_margin_bonus,
            "intermediary_markup_saved": intermediary_markup_saved,
            "unit": "kg",
            "trend": "up" if modal_kg > 40 else "stable",
            "source": "Government of India (data.gov.in)",
        })
    return processed


def fetch_live_mandi_prices(
    state: str = "Tamil Nadu",
    district: Optional[str] = None,
    commodity: Optional[str] = None,
    limit: int = 150,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    """
    Fetches official daily Mandi prices from data.gov.in Agmarknet API.
    Prioritizes Tenkasi, Tirunelveli, and Thoothukudi regional hubs with distinct, authentic local rates.
    Converts Quintal prices (₹/100kg) to Retail/Wholesale ₹/kg.
    """
    global _PRICE_CACHE

    now = time.time()
    cache_key = f"{state}:{district or 'HUBS'}:{commodity or ''}:{limit}"

    # Return cached data if valid and not forcing refresh
    if not force_refresh and _PRICE_CACHE.get(cache_key):
        cached_entry = _PRICE_CACHE[cache_key]
        if now - cached_entry["timestamp"] < CACHE_TTL_SECONDS:
            return {
                "source": "Government of India (data.gov.in - Agmarknet Live Cached)",
                "state": state,
                "district": district or "Tenkasi, Tirunelveli, Thoothukudi Hubs",
                "total": len(cached_entry["records"]),
                "records": cached_entry["records"],
                "cached": True,
                "last_updated": cached_entry["last_updated"],
            }

    api_key = getattr(settings, "DATA_GOV_API_KEY", None)
    resource_id = getattr(settings, "DATA_GOV_RESOURCE_ID", "9ef84268-d588-465a-a308-a864a43d0070")

    if not api_key:
        logger.warning("DATA_GOV_API_KEY is not configured.")
        return {"source": "data.gov.in", "total": 0, "records": [], "error": "API key not configured"}

    raw_records = []
    d_clean = (district or "").lower().strip()
    is_all_hubs = d_clean in ("", "all", "hubs", "all hubs", "tamil nadu", "all districts")

    # Fetch district-specific records
    if not is_all_hubs:
        if "tirunelveli" in d_clean or "nellai" in d_clean:
            res = _fetch_single_district_records(api_key, resource_id, state, "Thirunelveli", commodity, limit)
            for r in res:
                rc = dict(r)
                rc["district"] = "Tirunelveli"
                raw_records.append(rc)
        elif "thoothukudi" in d_clean or "tuticorin" in d_clean or "thuthukudi" in d_clean:
            res = _fetch_single_district_records(api_key, resource_id, state, "Tuticorin", commodity, limit)
            for r in res:
                rc = dict(r)
                rc["district"] = "Thoothukudi"
                raw_records.append(rc)
        elif "tenkasi" in d_clean:
            # Mandis in the Tenkasi agricultural belt (Thalavaipuram, Rajapalayam) registered under Virudhunagar border, plus Tenkasi
            with ThreadPoolExecutor(max_workers=2) as executor:
                v_res, t_res = list(executor.map(
                    lambda d: _fetch_single_district_records(api_key, resource_id, state, d, commodity, limit),
                    ["Virudhunagar", "Tenkasi"]
                ))
            for r in v_res:
                m = r.get("market", "")
                if any(k in m for k in ["Thalavai", "Rajapalayam", "Sankarankovil", "Alangulam"]):
                    rc = dict(r)
                    rc["district"] = "Tenkasi"
                    raw_records.append(rc)
            for r in t_res:
                rc = dict(r)
                rc["district"] = "Tenkasi"
                raw_records.append(rc)
        else:
            raw_records = _fetch_single_district_records(api_key, resource_id, state, district, commodity, limit)
    else:
        # Default mode: Concurrently fetch all 3 primary hubs
        # Thirunelveli (Palayamkottai, NGO Colony, Ambasamudram)
        # Tuticorin (Kovilpatti)
        # Virudhunagar border (Thalavaipuram, Rajapalayam serving Tenkasi corridor) & Tenkasi
        districts_to_fetch = ["Thirunelveli", "Tuticorin", "Virudhunagar", "Tenkasi"]
        def _fetch_hub(d: str):
            return _fetch_single_district_records(api_key, resource_id, state, d, commodity, limit)

        with ThreadPoolExecutor(max_workers=4) as executor:
            hub_results = list(executor.map(_fetch_hub, districts_to_fetch))

        # 0: Tirunelveli
        for r in hub_results[0]:
            rc = dict(r)
            rc["district"] = "Tirunelveli"
            raw_records.append(rc)

        # 1: Thoothukudi
        for r in hub_results[1]:
            rc = dict(r)
            rc["district"] = "Thoothukudi"
            raw_records.append(rc)

        # 2: Tenkasi border sandhais (Thalavaipuram, Rajapalayam)
        for r in hub_results[2]:
            m = r.get("market", "")
            if any(k in m for k in ["Thalavai", "Rajapalayam", "Sankarankovil", "Alangulam"]):
                rc = dict(r)
                rc["district"] = "Tenkasi"
                raw_records.append(rc)

        # 3: Direct Tenkasi entries if any
        for r in hub_results[3]:
            rc = dict(r)
            rc["district"] = "Tenkasi"
            raw_records.append(rc)

    # Fallback to statewide query if specific hub filters yielded no records
    if not raw_records:
        national_params = {
            "api-key": api_key,
            "format": "json",
            "limit": 250,
        }
        if commodity:
            national_params["filters[commodity]"] = commodity
        raw_records = _fetch_from_api(api_key, resource_id, national_params, timeout=12.0)

    if raw_records:
        processed_records = _process_records(raw_records, default_state=state)
        last_updated_str = time.strftime("%d %b %Y, %I:%M %p")
        _PRICE_CACHE[cache_key] = {
            "timestamp": now,
            "records": processed_records,
            "last_updated": last_updated_str,
        }
        return {
            "source": "Government of India (data.gov.in - Agmarknet Live)",
            "state": state,
            "district": district or "Tenkasi, Tirunelveli, Thoothukudi Hubs",
            "total": len(processed_records),
            "records": processed_records,
            "cached": False,
            "last_updated": last_updated_str,
        }

    # Fallback to existing cache if any
    if _PRICE_CACHE.get(cache_key):
        cached = _PRICE_CACHE[cache_key]
        return {
            "source": "Government of India (data.gov.in - Cached Backup)",
            "state": state,
            "district": district,
            "total": len(cached["records"]),
            "records": cached["records"],
            "cached": True,
            "last_updated": cached["last_updated"],
        }

    return {
        "source": "Government of India (data.gov.in)",
        "state": state,
        "district": district,
        "total": 0,
        "records": [],
        "error": "No records returned from data.gov.in for the requested selection.",
    }

"""
Generates a SYNTHETIC historical demand dataset for training/testing the
demand forecasting model ONLY. This is demo/training data -- it is written
to the `demand_data` table with is_synthetic=True and is NEVER used as, or
mixed into, actual marketplace listings (spec sections 17-19).

Run:
    python ml/preprocessing/generate_synthetic_demand.py
"""
import math
import random
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.append(str(Path(__file__).resolve().parents[2] / "backend"))

RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

PRODUCTS = [
    ("Tomato", "Vegetables", 25, 0.35),
    ("Onion", "Vegetables", 22, 0.20),
    ("Milk", "Dairy", 45, 0.05),
    ("Rice", "Rice", 40, 0.10),
    ("Eggs", "Poultry", 6, 0.15),
    ("Banana", "Fruits", 30, 0.25),
]
LOCATIONS = ["Chennai", "Tirunelveli", "Madurai", "Coimbatore", "Trichy"]

# Tamil Nadu festival-ish demand-spike dates for the synthetic window (illustrative, not authoritative).
FESTIVAL_DATES = {"01-14", "01-15", "08-15", "10-24", "11-12"}

START_DATE = date.today() - timedelta(days=365 * 2)
DAYS = 365 * 2


def generate() -> pd.DataFrame:
    rows = []
    for product_name, category, base_price, seasonality_amp in PRODUCTS:
        for location in LOCATIONS:
            base_demand = random.uniform(150, 400)
            location_factor = random.uniform(0.8, 1.3)
            trend_slope = random.uniform(-0.02, 0.05)  # gradual trend, per day

            for day_offset in range(DAYS):
                current_date = START_DATE + timedelta(days=day_offset)
                day_of_year = current_date.timetuple().tm_yday
                season = math.sin(2 * math.pi * day_of_year / 365.0)

                is_festival = current_date.strftime("%m-%d") in FESTIVAL_DATES
                festival_boost = random.uniform(1.3, 1.8) if is_festival else 1.0

                weekly_cycle = 1.0 + 0.1 * math.sin(2 * math.pi * current_date.weekday() / 7.0)

                trend = 1.0 + trend_slope * (day_offset / 30.0)
                noise = np.random.normal(1.0, 0.08)

                demand = (
                    base_demand * location_factor * trend * weekly_cycle
                    * (1 + seasonality_amp * season) * festival_boost * noise
                )
                demand = max(10.0, demand)

                price = base_price * (1 + 0.15 * season) * random.uniform(0.9, 1.1)
                price = max(1.0, price)

                rows.append({
                    "product_name": product_name,
                    "category": category,
                    "location": location,
                    "record_date": current_date.isoformat(),
                    "demand_quantity": round(demand, 2),
                    "price": round(price, 2),
                    "is_festival": is_festival,
                    "is_synthetic": True,
                })
    return pd.DataFrame(rows)


if __name__ == "__main__":
    df = generate()
    out_path = Path(__file__).resolve().parents[1] / "data" / "synthetic_demand_data.csv"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False)
    print(f"Generated {len(df)} SYNTHETIC demand rows (seed={RANDOM_SEED}) -> {out_path}")
    print("Label: Synthetic training/demo data. Not real government or marketplace data.")

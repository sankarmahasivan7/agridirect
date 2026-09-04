"""
Trains a demand forecasting model (GradientBoostingRegressor) on the
synthetic (or, once available, real) historical demand dataset.

Prints real MAE / RMSE / R^2 on a held-out test split -- these metrics are
never fabricated (spec section 17).

Run:
    python ml/training/generate_synthetic_demand.py   # if not already run
    python ml/training/train_demand_model.py
"""
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "synthetic_demand_data.csv"
MODEL_DIR = Path(__file__).resolve().parents[1] / "models"
MODEL_PATH = MODEL_DIR / "demand_model.joblib"
METRICS_PATH = MODEL_DIR / "demand_model_metrics.json"

RANDOM_SEED = 42


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["record_date"] = pd.to_datetime(df["record_date"])
    df["month"] = df["record_date"].dt.month
    df["day_of_week"] = df["record_date"].dt.dayofweek
    df["day_of_year"] = df["record_date"].dt.dayofyear
    df = df.sort_values(["product_name", "location", "record_date"])
    df["prev_week_demand"] = df.groupby(["product_name", "location"])["demand_quantity"].shift(7)
    df["prev_month_demand"] = df.groupby(["product_name", "location"])["demand_quantity"].shift(30)
    df["prev_week_demand"] = df["prev_week_demand"].fillna(df["demand_quantity"].median())
    df["prev_month_demand"] = df["prev_month_demand"].fillna(df["demand_quantity"].median())
    return df


FEATURE_COLUMNS_NUM = ["month", "day_of_week", "day_of_year", "price", "prev_week_demand", "prev_month_demand"]
FEATURE_COLUMNS_CAT = ["product_name", "category", "location", "is_festival"]
TARGET = "demand_quantity"


def main():
    if not DATA_PATH.exists():
        raise SystemExit(
            f"No dataset found at {DATA_PATH}.\n"
            "Not enough historical data to generate a forecast -- "
            "run generate_synthetic_demand.py first, or export real demand_data rows."
        )

    df = pd.read_csv(DATA_PATH)
    df = build_features(df)

    X = df[FEATURE_COLUMNS_NUM + FEATURE_COLUMNS_CAT]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=RANDOM_SEED)

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), FEATURE_COLUMNS_CAT),
        ],
        remainder="passthrough",
    )

    model = Pipeline(steps=[
        ("preprocess", preprocessor),
        ("regressor", GradientBoostingRegressor(random_state=RANDOM_SEED)),
    ])

    model.fit(X_train, y_train)
    preds = model.predict(X_test)

    mae = mean_absolute_error(y_test, preds)
    rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
    r2 = r2_score(y_test, preds)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "feature_columns": FEATURE_COLUMNS_NUM + FEATURE_COLUMNS_CAT}, MODEL_PATH)

    metrics = {"mae": round(mae, 3), "rmse": round(rmse, 3), "r2": round(r2, 4), "n_test": len(y_test)}
    METRICS_PATH.write_text(json.dumps(metrics, indent=2))

    print("Model trained and saved to:", MODEL_PATH)
    print("Real held-out test metrics:", metrics)


if __name__ == "__main__":
    main()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import recipes, meal_plans, users, household

app = FastAPI(title="Meal Planner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recipes.router)
app.include_router(meal_plans.router)
app.include_router(users.router)
app.include_router(household.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/seed", tags=["admin"], status_code=204)
def run_seed():
    from app.db.seed import seed_household
    seed_household()

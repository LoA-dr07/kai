from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import recipes, meal_plans, users, household, ai, powersync

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
app.include_router(ai.router)
app.include_router(powersync.router, prefix="/auth")


@app.get("/health")
def health_check():
    return {"status": "ok"}

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db
from app.routers import recipes, meal_plans, users, household, ai, powersync, shopping_list

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
app.include_router(shopping_list.router)
app.include_router(powersync.router, prefix="/auth")


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}

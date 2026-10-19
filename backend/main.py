"""
DayPerDay AI - FastAPI Backend
Serves as the Python backend with Ollama AI integration, financial calculations,
and scheduled reports. The frontend uses Supabase directly for auth and CRUD;
this backend provides AI services and server-side calculations.
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routers import ai, finance, reports, scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the background scheduler on startup
    await scheduler.start_scheduler()
    yield
    # Shutdown scheduler on exit
    await scheduler.stop_scheduler()

app = FastAPI(
    title="DayPerDay AI API",
    description="AI-powered daily planning, finance, and goal management backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - allow the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])
app.include_router(finance.router, prefix="/api/finance", tags=["Finance"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])

@app.get("/")
async def root():
    return {"name": "DayPerDay AI API", "status": "running", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router

app = FastAPI(
    title="Marketing Automation AI",
    description="AI-powered marketing automation platform for Vervotech",
    version="1.0.0",
)

# Always include localhost origins for local dev.
# In production (Railway) set FRONTEND_URL=https://your-frontend.up.railway.app
_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
]
_frontend_url = os.environ.get("FRONTEND_URL", "").strip().rstrip("/")
if _frontend_url:
    _origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "message": "Marketing Automation AI Backend Running",
        "version": "1.0.0",
        "agents": ["agent1", "agent2", "agent4", "agent3"],
    }

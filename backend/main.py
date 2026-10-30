import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from database import initialize_database
from routers import advisor, auth, sync

app = FastAPI(title="SyncSpace AI API")
FRONTEND_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",")
    if origin.strip()
]

initialize_database()

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def verify_browser_origin(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and request.method not in {"GET", "HEAD", "OPTIONS"} and origin.rstrip("/") not in FRONTEND_ORIGINS:
        return JSONResponse(status_code=403, content={"detail": "This browser origin is not allowed."})
    return await call_next(request)

app.include_router(auth.router)
app.include_router(sync.router)
app.include_router(advisor.router)

@app.get("/")
def read_root():
    return {"message": "SyncSpace AI Backend is running!", "status": "success"}

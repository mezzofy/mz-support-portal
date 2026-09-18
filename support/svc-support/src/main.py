from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from starlette.middleware.gzip import GZipMiddleware
from mangum import Mangum
from strawberry.fastapi import GraphQLRouter

from controllers.graphql.schema import schema
from controllers.graphql.context import get_context
from core.config import settings

# Static files directory (web-support build output bundled alongside the service).
# main.py is in src/, public/ is at ../public/ relative to src/. The Frontend team
# drops its Vite build into public/ later; the static serving is wired here now.
PUBLIC_DIR = Path(__file__).parent.parent / "public"

NO_CACHE_HEADERS = {"Cache-Control": "no-cache, no-store, must-revalidate"}
ASSET_CACHE_HEADERS = {"Cache-Control": "public, max-age=31536000, immutable"}

app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="Support-Staff Console API for Mezzofy (cross-merchant tickets)",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# GraphQL router — authentication/RBAC is enforced in get_context.
graphql_router = GraphQLRouter(schema, context_getter=get_context)
app.include_router(graphql_router, prefix="/support/api/graphql")


@app.get("/support/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "mz-support-console-v3",
        "version": settings.API_VERSION,
    }


@app.get("/support/heartbeat")
async def heartbeat():
    """Heartbeat endpoint"""
    return {
        "Application": "Mezzofy Support Console API",
        "module": "Support Module",
        "status": "Active",
        "version": settings.API_VERSION,
    }


# ── SPA Static File Serving (web-support build dropped into public/) ──────────


@app.get("/support")
async def serve_spa_root():
    """Serve the SPA index.html at /support"""
    index = PUBLIC_DIR / "index.html"
    if index.is_file():
        return FileResponse(index, media_type="text/html", headers=NO_CACHE_HEADERS)
    return JSONResponse(content={
        "service": "Mezzofy Support Console API",
        "version": settings.API_VERSION,
        "graphql": "/support/api/graphql",
        "health": "/support/health",
    })


@app.get("/support/{full_path:path}")
async def serve_spa(full_path: str):
    """Serve static assets from public/ or fall back to index.html for SPA routes"""
    if full_path.startswith("api/"):
        return JSONResponse(status_code=404, content={"detail": "Not found"})

    file_path = PUBLIC_DIR / full_path
    if file_path.is_file():
        headers = ASSET_CACHE_HEADERS if "/assets/" in full_path else NO_CACHE_HEADERS
        return FileResponse(file_path, headers=headers)

    index = PUBLIC_DIR / "index.html"
    if index.is_file():
        return FileResponse(index, media_type="text/html", headers=NO_CACHE_HEADERS)

    return JSONResponse(status_code=404, content={"detail": "Web UI not bundled"})


# Lambda handler for AWS deployment
handler = Mangum(app)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,  # 8005
        reload=True,
    )

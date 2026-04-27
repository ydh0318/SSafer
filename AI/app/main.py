from fastapi import FastAPI

from app.api.analysis import router as analysis_router

app = FastAPI(title="AI Security Analysis API")

app.include_router(analysis_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}

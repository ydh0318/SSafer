from fastapi import FastAPI

app = FastAPI(title="AI Security Analysis API")


@app.get("/health")
def health_check():
    return {"status": "ok"}

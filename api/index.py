from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any
import os
import re
from google import genai

# IMPORTANT: Because we moved the folder, we import from .train
# If this fails locally, use 'try: from train...' but for Vercel use .train
try:
    from .train.model_sampler import Sampler
except ImportError:
    from train.model_sampler import Sampler

app = FastAPI()

# Allow all origins (for now) - Update with your Vercel URL in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Gemini
# Ensure GEMINI_API_KEY is set in Vercel Project Settings
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

# Initialize Sampler
# If Torch is too big for Vercel, this block will cause the crash.
try:
    sampler = Sampler()
    print("✅ Model Sampler Loaded")
except Exception as e:
    print(f"⚠️ Model Sampler Failed to Load: {e}")
    sampler = None

class HitRequest(BaseModel):
    x: Optional[float]
    y: Optional[float]
    div_id: Optional[str]
    predict_other: Optional[Dict[str, Any]]

class GenerateCodeRequest(BaseModel):
    prompt: str
    code: str

@app.get("/api/health")
async def health():
    return {"status": "ok", "backend": "FastAPI on Vercel"}

@app.post('/api/get_hit_count')
async def get_hit_count(body: HitRequest):
    if sampler is None:
        return {"count": 0, "error": "Model could not be loaded on Vercel (Size Limit)"}
    
    try:
        count = int(sampler.sample(body.x, body.y, body.div_id, body.predict_other))
        return {"count": count}
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate_code")
async def generate_code(request: GenerateCodeRequest):
    try:
        full_prompt = f"""
        You are an expert React developer.
        Update this App.jsx code based on this request: "{request.prompt}"
        EXISTING CODE: {request.code}
        Return ONLY the raw code string. No markdown.
        """

        # Using a stable model version
        response = client.models.generate_content(
            model='gemini-2.0-flash', 
            contents=full_prompt
        )
        text = response.text

        # Clean markdown
        cleaned_code = re.sub(r"```jsx|```", "", text).strip()
        return {"code": cleaned_code}

    except Exception as error:
        print(f"Gemini Error: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))

# Note: No 'uvicorn.run' block needed for Vercel
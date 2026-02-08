from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any
import random
from train.model_sampler import Sampler
from google import genai
import os
import re

app = FastAPI()

# Allow requests from the frontend dev server (and others) during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key = os.getenv("GEMINI_API_KEY")  # or replace with your key string
client = genai.Client(api_key=api_key)

class HitRequest(BaseModel):
    x: Optional[float]
    y: Optional[float]
    div_id: Optional[str]
    predict_other: Optional[Dict[str, Any]]

class RunPipelineRequest(BaseModel):
    html: str

sampler = Sampler()

@app.post('/api/get_hit_count')
async def get_hit_count(body: HitRequest):
    count = int(sampler.sample(body.x, body.y, body.div_id, body.predict_other))
    # predict_other
    # count = int(nn_model(predict_x=body.x, predict_y=body.y, predict_id=body.div_id))
    print(count)
    return {"count": count}

# Request body schema
class GenerateCodeRequest(BaseModel):
    prompt: str
    code: str


@app.post("/api/generate_code")
async def generate_code(request: GenerateCodeRequest):
    try:
        full_prompt = f"""
        You are an expert React developer.
        Update this App.jsx code based on this request: "{request.prompt}"
        EXISTING CODE: {request.code}
        Return ONLY the raw code string. No markdown.
        """

        response = client.models.generate_content(
            model='gemini-3-flash-preview',
            contents=full_prompt)
        text = response.text

        # Remove markdown code fences if present
        cleaned_code = re.sub(r"```jsx|```", "", text).strip()

        return {"code": cleaned_code}

    except Exception as error:
        print("❌ SERVER CRASH DETAILS:")
        print("Message:", str(error))
        raise HTTPException(status_code=500, detail=str(error))

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8001)

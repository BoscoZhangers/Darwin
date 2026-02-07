from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import random
from train.model_sampler import Sampler

app = FastAPI()

# Allow requests from the frontend dev server (and others) during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HitRequest(BaseModel):
    x: Optional[float]
    y: Optional[float]
    div_id: Optional[str]

sampler = Sampler()
map = {"btn-1" : 0, "hero-1": 1}

@app.post('/api/get_hit_count')
async def get_hit_count(body: HitRequest):
    count = int(sampler.sample(body.x, body.y, map[body.div_id]))
    print(count)
    return {"count": count}


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8001)

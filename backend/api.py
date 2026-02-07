from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import random

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


@app.post('/api/get_hit_count')
async def get_hit_count(body: HitRequest):
    """Return a dummy number of users for the provided hit (x,y,div_id).

    This is a simple stub used for frontend integration and testing.
    """
    # Produce a pseudo-random but bounded user count.
    base = 100
    # Slightly vary by div_id if present so results are somewhat stable per id
    if body.div_id:
        seed = sum(ord(c) for c in body.div_id)
        random.seed(seed + (int(body.x or 0) * 13) + (int(body.y or 0) * 7))
    else:
        random.seed()

    count = base + random.randint(-40, 120)
    count = max(0, count)
    return {"count": count}


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8001)

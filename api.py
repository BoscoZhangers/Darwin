from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any
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

# @app.post('/api/run_pipeline')
# async def run_pipeline(body: RunPipelineRequest):
#     # This method fetches the user uploaded html from the frontend
#     # Writes to csv to local

#     pass
    

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8001)

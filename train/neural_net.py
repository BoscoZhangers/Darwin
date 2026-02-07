import torch
import torch.nn as nn

FEATURES = ["x", "y", "div_id"]
NUM_FEATURES = len(FEATURES)

NUM_DIVS = 5
EMBEDDING_DIM = 256
INNER_LAYER_SIZE = 128


class Predictor(nn.Module):
    def __init__(self):
        super().__init__()

        #self.div_embedding = nn.Embedding(NUM_DIVS, EMBEDDING_DIM)

        self.net = nn.Sequential(
            #nn.Linear(EMBEDDING_DIM, INNER_LAYER_SIZE),
            nn.Linear(NUM_FEATURES, INNER_LAYER_SIZE),
            nn.ReLU(),
            nn.Linear(INNER_LAYER_SIZE, INNER_LAYER_SIZE),
            nn.ReLU(),
            nn.Linear(INNER_LAYER_SIZE, INNER_LAYER_SIZE),
            nn.ReLU(),
            nn.Linear(INNER_LAYER_SIZE, 1) # Output is clicks
        )

    def forward(self, x):
        return self.net(x)
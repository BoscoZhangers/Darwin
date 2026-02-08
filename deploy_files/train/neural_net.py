import torch
import torch.nn as nn

# FEATURES = 
# NUM_FEATURES = len(FEATURES)

NUM_DIVS = 5
EMBEDDING_DIM = 256
INNER_LAYER_SIZE = 256
HIDDEN_LAYERS = 16


class Predictor(nn.Module):
    def __init__(self, num_features):
        super().__init__()

        #self.div_embedding = nn.Embedding(NUM_DIVS, EMBEDDING_DIM)

        layers = []

        # Input layer
        layers.append(nn.Linear(num_features, INNER_LAYER_SIZE))
        layers.append(nn.ReLU())

        for _ in range(HIDDEN_LAYERS):
            layers.append(nn.Linear(INNER_LAYER_SIZE, INNER_LAYER_SIZE))
            layers.append(nn.ReLU())

        # Output layer
        layers.append(nn.Linear(INNER_LAYER_SIZE, 1))

        self.net = nn.Sequential(*layers)

    def forward(self, x):
        return self.net(x)
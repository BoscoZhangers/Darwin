from sklearn.preprocessing import StandardScaler
import pandas as pd
from train.neural_net import Predictor
import os
import torch
import numpy as np

class Sampler():
    def __init__(self):
        self.scaler = StandardScaler()

        df = pd.read_csv("./data/test_data.csv")
        X = df[["x", "y", "div id"]].copy()

        self.scaler.fit_transform(X[["x", "y"]].to_numpy())

        self.model = Predictor()

        if os.path.exists('./train/train.pth'):
            self.model.load_state_dict(torch.load('./train/train.pth'))
            print("Model loaded successfully")
        else:
            print("Model not exist")
    
    def sample(self, x, y, div_id):
        self.model.eval()
        transformed = self.scaler.transform(np.array([[x, y]]))
        count = self.model(torch.tensor([transformed[0, 0], transformed[0, 1], div_id], dtype=torch.float32))
        print(f"[{x}, {y}, {div_id}]", count)
        return max(0, count.item())


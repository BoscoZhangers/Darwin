import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error
from neural_net import Predictor
from torch.utils.data import TensorDataset, DataLoader
import numpy as np
import os

TRAIN_EPOCHES = 5000

def train(model, X_train, y_train):
    dataset = TensorDataset(X_train, y_train)
    loader = DataLoader(dataset, batch_size=32, shuffle=True)

    loss_fn = nn.MSELoss()
    optimizer = optim.AdamW(model.parameters(), lr=0.001)

    for epoch in range(TRAIN_EPOCHES):
        model.train()
        for batch_X, batch_y in loader:
            # print(batch_X)
            preds = model(batch_X)
            loss = loss_fn(preds, batch_y)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
        
        if epoch % 20 == 0:
            print(f"Epoch {epoch}, Loss: {loss.item():.4f}")

def eval(model, X_test, y_test):
    model.eval()

    with torch.no_grad():
        test_preds = model(X_test)

    mae = mean_absolute_error(y_test.numpy(), test_preds.numpy())
    print("Test MAE:", mae)

def test(x, y, div_id, scaler, model):
    model.eval()
    transformed = scaler.transform(np.array([[x, y]]))
    print(f"[{x}, {y}, {div_id}]", model(torch.tensor([transformed[0, 0], transformed[0, 1], div_id], dtype=torch.float32)))


def main():
    df = pd.read_csv("../data/test_data.csv")
    X = df[["x", "y", "div id"]].copy()
    y = df["clicks"].values

    scaler = StandardScaler()
    X[["x", "y"]] = scaler.fit_transform(X[["x", "y"]].to_numpy())

    X_train, X_test, y_train, y_test = train_test_split(X.values, y, test_size=0.2, random_state=42)
    X_train = torch.tensor(X_train, dtype=torch.float32)
    X_test = torch.tensor(X_test, dtype=torch.float32)

    y_train = torch.tensor(y_train, dtype=torch.float32).view(-1, 1)
    y_test = torch.tensor(y_test, dtype=torch.float32).view(-1, 1)

    # print(X_train, X_test, y_train, y_test)

    model = Predictor()

    if os.path.exists('train.pth'):
        model.load_state_dict(torch.load('train.pth'))
        print("Model loaded successfully")
    else:
        train(model, X_train, y_train)
        eval(model, X_test, y_test)
        torch.save(model.state_dict(), 'train.pth')

    # a = scaler.transform(np.array([[5, 100]]))
    # b = scaler.transform(np.array([[3, 200]]))

    # print("[5, 100, 0]", model(torch.tensor([a[0, 0], a[0, 1], 0], dtype=torch.float32)))
    # # print("[3, 100, 1]", model(torch.tensor([3, 100, 1], dtype=torch.float32)))
    # print("[3, 200, 0]", model(torch.tensor([b[0, 0], b[0, 1], 0], dtype=torch.float32)))

    test(5, 100, 0, scaler, model)
    test(3, 200, 0, scaler, model)
    test(3, 100, 1, scaler, model)
    test(5, 50, 0, scaler, model)
    test(5, 75, 0, scaler, model)
    test(5, 95, 0, scaler, model)
    test(30, 280, 2, scaler, model) #60
    test(30, 20, 2, scaler, model)
    test(30, 500, 2, scaler, model)



#if __name__ == "__main__":
main()


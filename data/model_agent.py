# Import Libraries
import os
os.environ["KMP_DUPLICATE_LIB_OK"]="TRUE"
import torch
import torch.nn as nn
import torch.optim as optim

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from bs4 import BeautifulSoup
import cssutils
import logging
from PIL import ImageColor
from pandas.api.types import is_numeric_dtype
import json
import seaborn as sns
from google import genai
from pydantic import BaseModel, Field

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error
from torch.utils.data import TensorDataset, DataLoader

import re
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY_DARWIN")

webpage= """
<div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: 'white' }}>

      {/* 1. INITIALIZE THE TRACKER */}
      {/* Replace 'BoscoZhangers_darwin-test-site' with your unique repo ID */}
      <DarwinTracker repoId="BoscoZhangers_darwin-test-site" />

      {/* 2. ADD 'data-darwin-id' TO ELEMENTS YOU WANT TO TRACK */}

      {/* Navbar */}
      <nav
        data-darwin-id="nav-main"
        style={{ position: 'absolute', left: 0, top: 0, width: 450, height: 64, backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', padding: '24px', boxSizing: 'border-box' }}
      >
        <h1  style={{ fontWeight: 'bold', margin: 0 }}>Startup.io</h1>
      </nav>

      {/* Hero Text */}
      <h1
        data-darwin-id="hero-text"
        style={{ position: 'absolute', left: 40, top: 140, width: 350, height: 100, fontSize: '3.5rem', color: '#000', margin: 0, lineHeight: 1 }}
      >
        Build Faster.
      </h1>

      {/* CTA Button */}
      <button
        data-darwin-id="btn-cta"
        style={{ position: 'absolute', left: 40, top: 240, width: 140, height: 48, backgroundColor: '#000', borderRadius: '8px', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
      >
        Get Started
      </button>

    </div>
"""

def vectorize_css(webpage):
    '''
    For each id in the html file, convert its style attributes into a table,
    Return the table with a list of all divs

    webpage: The original html file, as a string
    '''
    def parse_darwin_styles(jsx_text):
        # Pattern explanation:
        # 1. Look for data-darwin-id="ID_NAME"
        # 2. Look for style={{ STYLE_CONTENT }}
        # We use a non-greedy dot .*? to stay within the braces
        pattern = r'data-darwin-id="([^"]+)"[\s\S]*?style=\{\{([^}]+)\}\}'
        
        matches = re.finditer(pattern, jsx_text)
        results = {}

        for match in matches:
            darwin_id = match.group(1)
            style_content = match.group(2).strip()
            
            # Split properties by comma, but be careful of nested commas (like in padding)
            # For simple inline styles, splitting by comma and colon works:
            style_dict = {}
            props = re.findall(r"(\w+):\s*['\"]?([^'\",]+)['\"]?", style_content)
            
            for key, value in props:
                # Clean up numeric values
                try:
                    if value.isdigit():
                        style_dict[key] = int(value)
                    else:
                        style_dict[key] = value
                except:
                    style_dict[key] = value
                    
            results[darwin_id] = style_dict

        return results

    # Execute
    parsed_styles = parse_darwin_styles(webpage)

    # View results for one element
    df = pd.DataFrame(parsed_styles).T

    def fill_rgb(x):
        if pd.isna(x) or x=='' or x is None:
            return (-1,-1,-1)
        try:
            return ImageColor.getrgb(x)
        except:
            return (-1,-1,-1)

    def is_measurement(col):
        for i in col:
            if 'px' in i or 'rem' in i:
                return True
        return False

    def fill_measurement(col):
        vals = []
        measurement_type = ""
        for i in col:
            try:
                if 'px' in i:
                    measurement_type = 'px'
                    vals.append(float(i.split('px')[0]))
                elif 'rem' in i:
                    measurement_type = 'rem'
                    vals.append(float(i.split('rem')[0]))
                else:
                    vals.append(None)
            except:
                vals.append(None)
        none_replacement = 16 if measurement_type == 'px' else 1
        return [x if x is not None else none_replacement for x in vals]

    # Convert colour columns into categories
    for col in df.columns:
        # 1. Try to force it to numeric (handles strings like "450")
        converted_col = pd.to_numeric(df[col], errors='coerce')

        if not converted_col.isna().all():
            # It's actually numeric! Update the column.
            df[col] = converted_col
            print(f"{col} is Numeric.")
        elif is_measurement(df[col].dropna().tolist()):
            df[col] = fill_measurement(df[col].tolist())
            print(f"{col} is a measurement")
        elif 'color' in col or 'Color' in col:
            # It's a complex object (like your RGB color tuples)
            df[col] = df[col].apply(lambda x: fill_rgb(x))
            print(f"{col} is a Color/Complex object (Needs expansion).")
        else:
            print(df[col].tolist())
            # It's a true categorical string (like "solid" or "relative")
            df[col] = df[col].astype('category')
            print(f"{col} is Categorical.")


    categorical_cols = []
    for col in df:
    # Convert colour columns into categories
        if 'color' in col or 'Color' in col:
            df[col] = df[col].apply(lambda x: x if isinstance(x, tuple) else (-1,-1,-1)) # transparent
            df[[col+'_R',col+'_G',col+'_B']] = pd.DataFrame(df[col].tolist(), index=df.index)
            df = df.drop(columns=[col])
        # detect non-numeric columns as categories
        else:
            df[col] = pd.to_numeric(df[col], errors='ignore')
            if not is_numeric_dtype(df[col]):
                categorical_cols.append(col)

    df=pd.get_dummies(df, columns=categorical_cols, dtype=int)
    return df, list(df.index)


def design_agent(number_iter,list_of_classes):
    '''
    Gemini agent for generating a list of modified html pages for A/B testing

    number_iter: number of html templates agent will generate
    '''
    client = genai.Client(api_key = GOOGLE_API_KEY)

    class new_html(BaseModel):
        tests: list[str] = Field(description="A list of the HTML files generated by the Agent")


    prompt = """
    You are a designer for a website written in jsx, who wants to make modifications to the website for A/B testing. 
    I want you to run the below process %s times. Note that the list of ids you can change is %s

    Process:
    1. Layout Phase:
        If this is the first time the process is ran, use the default x,y coordinates of the upper left corner of each div
        If this is not the first time the process is ran, change the x,y coordinates to mimic an A/B test
    2. Design Phase:
        Change at least existing attribute for a tag containing 'data-darwin-id' in a way that makes sense for an A/B test. You may add an attribute to a class if it exists in a different class, but not
        if it is net new to the document. Only modify colors and sizes, do not modify any categorical data. Do not combine multiple classes into one style
        (ex: Do Not do 'Class1, Class2 {...}')


    NOTES:

    Assume the viewport is 1920x1080

    Provide Coordinates Relative to the top-left of the page

    Assume default heights relative to the viewport for objects with no specified heights

    Website is: 
    %s
    """% (number_iter, list_of_classes, webpage)


    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_json_schema": new_html.model_json_schema(),
        }
    )

    return response.text


def click_agent(output_len, html_files,list_of_classes):
    '''
    Gemini Model for simulating clicks on the templates generated by design_agent

    output_len: Number of clicks simulated per template
    html_files: list of templates
    '''
    client = genai.Client(api_key = GOOGLE_API_KEY)

    class click(BaseModel):
        x: int = Field(description="x coordinate")
        y: int = Field(description="y coordinate")
        div_id: str = Field(description="class/id of div. If a simulated click is not one of these, leave this blank")

    class clickSimulation(BaseModel):
        clicks: list[click] = Field(description="A list of %s simulated user clicks" % (output_len))
        html: list[str] = Field(description="The HTML File generated from this process run")

    class allSims(BaseModel):
        sims: list[clickSimulation] = Field(description="A list of simulations")

    prompt = """
    You are a user of the following website, with the purpose of clicking on the different divs within the website, simulating an actual user. 
    Your clicks will be used to train a model that forecasts how many clicks a div would get if it was moved to another location.

    For each website in the given list, Simulate %s clicks. These clicks are intent-driven, and should simulate an F-pattern. 
    For x and y, have them represent the upper left corner of the div. Note that the list of ids you can change is %s

    NOTES:

    Assume the viewport is 1920x1080

    Provide Coordinates Relative to the top-left of the page

    Assume default heights relative to the viewport for objects with no specified heights

    The list of websites are: 
    %s
    """% (output_len, list_of_classes, html_files)


    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_json_schema": allSims.model_json_schema(),
        }
    )

    return response.text

def __main__():
    # Get initial attributes df
    df, list_of_classes = vectorize_css(webpage)
    print('---------------------------------Done Initial processing---------------------------------')

    # Run Agents
    html_files = design_agent(15,list_of_classes)
    click_data = click_agent(40, html_files,list_of_classes)
    print('---------------------------------Done Agent Execution---------------------------------')

    # Process Agent Data
    data_dict = json.loads(click_data)['sims']
    data_vectors = []
    for i in data_dict:
        sim_df, temp = vectorize_css(i['html'][0])
        print(i)
        for j in i['clicks']:
            click_list = list(j.values())

            try:
                df_key = '#'+click_list[2] # get div id
                attribute_list = sim_df.loc[df_key].tolist() # get list of attributes
                click_list[2] = list_of_classes.index(df_key) # change class into category
                data_vectors.append(click_list+attribute_list+[1]) # add to data vectors
            except:
                df_key = click_list[2] # alternate id name
                attribute_list = sim_df.loc[df_key].tolist()
                click_list[2] = list_of_classes.index(df_key)
                data_vectors.append(click_list+attribute_list+[1])
            finally:
                continue
    print('---------------------------------Done Agent Data Processing---------------------------------')

    column_names = ['x','y','div_category']+list(sim_df.columns)+['hits']
    final_df = pd.DataFrame(data_vectors, columns=column_names)
    grouped_df = final_df.groupby(column_names[:-1]).agg({'hits': 'sum'}).reset_index()
    grouped_df.to_csv('sim_clicks_official.csv')
    #nn_model(grouped_df)
    print('---------------------------------Done :D---------------------------------')
    return grouped_df, df

csv_path = 'grouped_df.csv' if "data" in os.getcwd() else './data/grouped_df.csv'
def nn_model(df = pd.read_csv(csv_path), NUM_DIVS = 5, EMBEDDING_DIM = 256, INNER_LAYER_SIZE = 128, TRAIN_EPOCHES = 4000, predict_x = None, predict_y = None, predict_id = None, predict_other = None, 
                predict_ref = vectorize_css(webpage)[0]):
    
    FEATURES = [col for col in df.columns if col != 'hits'][1:]
    NUM_FEATURES = len(FEATURES)

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
        
    def train(model, X_train, y_train):
        dataset = TensorDataset(X_train, y_train)
        loader = DataLoader(dataset, batch_size=32, shuffle=True)

        loss_fn = nn.MSELoss()
        optimizer = optim.AdamW(model.parameters(), lr=0.001)

        for epoch in range(TRAIN_EPOCHES):
            model.train()
            for batch_X, batch_y in loader:
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

    def test(model, X_sample, y_sample=None):
        model.eval()
        with torch.no_grad():
            prediction = model(X_sample)
        print(f"Input Features Sample: {X_sample.cpu().numpy()}")
        print(f"Predicted Clicks: {prediction.item():.2f}")
        if y_sample is not None:
            print(f"Actual Clicks: {y_sample.item():.2f}")
        return prediction

    file_path = 'FINALtrain.pth' if "data" in os.getcwd() else './data/FINALtrain.pth'

    def pipeline():
        X = df[FEATURES].copy()
        y = df[df.columns[-1]].values

        # Scaling for numerical features
        scaler = StandardScaler()
        X_scaled = X.copy()
        numerical_cols = X.select_dtypes(include=np.number).columns
        
        # Only apply scaler if numerical_cols is not empty
        if not numerical_cols.empty:
            X_scaled[numerical_cols] = scaler.fit_transform(X[numerical_cols])
        else:
            print("Warning: No numerical columns found for scaling. Proceeding without scaling these features.")

        X_train, X_test, y_train, y_test = train_test_split(X_scaled.values, y, test_size=0.2, random_state=42)
        X_train = torch.tensor(X_train, dtype=torch.float32)
        X_test = torch.tensor(X_test, dtype=torch.float32)

        y_train = torch.tensor(y_train, dtype=torch.float32).view(-1, 1)
        y_test = torch.tensor(y_test, dtype=torch.float32).view(-1, 1)

        model = Predictor() # Predictor class instantiated with global NUM_FEATURES from previous cell

        if os.path.exists(file_path):
            model.load_state_dict(torch.load(file_path))
            print("Model loaded successfully")
        else:
            train(model, X_train, y_train)
            eval(model, X_test, y_test)
            torch.save(model.state_dict(), file_path)

        test(model, X_test[0], y_test[0])

    if predict_x is None:
        pipeline()
    else:
        conversion_table = {
            'nav-main': 0,
            'hero-text': 1,
            'btn-cta': 2,
            'description': 3,
            'btn-cta-2': 4
        }

        new_attributes = []
        for row in predict_ref.loc[predict_id].items():
            if predict_other is not None and row[0] in predict_other.keys():
                new_attributes.append(predict_other[row[0]])
            else:
                new_attributes.append(row[1])
        print(np.array([predict_x, predict_y, conversion_table[predict_id]]+ new_attributes))
        x_predict = torch.tensor(np.nan_to_num(np.array([predict_x, predict_y, conversion_table[predict_id]]+ new_attributes), nan=-1.0), dtype=torch.float32)

        model = Predictor() # Predictor class instantiated with global NUM_FEATURES from previous cell
        model.load_state_dict(torch.load(file_path))
        print("Model loaded successfully")
        return test(model, x_predict)

if __name__ == "__main__":
    #
    # feature_df, initial_df = __main__()

    feature_df, initial_df = pd.read_csv("./data/grouped_df.csv"), vectorize_css(webpage)[0]

    while True:
        location = input("Input x y div_id. type 'N' to exit: ")
        new_location = location.split(" ")
        try:
            if location[0] == 'N':
                break
            else:
                nn_model(feature_df, NUM_DIVS = 5, EMBEDDING_DIM = 256, INNER_LAYER_SIZE = 128, TRAIN_EPOCHES = 4000, predict_x = 0, predict_y = 0, predict_id = 'hero-text', predict_ref = initial_df)
        except:
            continue

       

from sklearn.preprocessing import StandardScaler
import pandas as pd
from train.neural_net import Predictor
# from neural_net import Predictor
import os
import torch
import numpy as np
from PIL import ImageColor
from pandas.api.types import is_numeric_dtype
import re

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

        <div
        data-darwin-id="description"
        style={{ position: 'absolute', left: 40, top: 300, width: 400, height: 48, backgroundColor: '#ffffff', borderRadius: '8px', color: 'black', border: 'none', cursor: 'pointer' }}
        >
            <h5>
            Some small details to describe what this project is about. We make changes to the properties of web components to see how simulated users will react.
            </h5>
        </div>

        <button
            data-darwin-id="btn-cta-2"
            style={{ position: 'absolute', left: 120, top: 470, width: 240, height: 60, backgroundColor: '#1bb556', borderRadius: '12px', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer'}}
        >
            Take the change today.
        </button>

        </div>
    """


class Sampler():
    def __init__(self):
        self.scaler = StandardScaler()
        self.color_scaler = StandardScaler()
        self.size_scaler = StandardScaler()

        df = pd.read_csv("./data/synthetic_data.csv")
        X = df[[col for col in df.columns if col != 'hits']].copy()

        self.scaler.fit_transform(X[["x", "y"]].to_numpy())
        self.color_scaler.fit(X[["backgroundColor_R", "backgroundColor_G", "backgroundColor_B"]].to_numpy())
        self.size_scaler.fit(X[["left", "top", "width", "height"]].to_numpy())

        self.model = Predictor(len([col for col in df.columns if col != 'hits']))

        if os.path.exists('./train/train.pth'):
            self.model.load_state_dict(torch.load('./train/train.pth'))
            print("Model loaded successfully")
        else:
            print("Model not exist")

    
    def vectorize_css(self, webpage):
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
                df[col] = pd.to_numeric(df[col], errors='coerce')
                if not is_numeric_dtype(df[col]):
                    categorical_cols.append(col)

        df=pd.get_dummies(df, columns=categorical_cols, dtype=int)
        return df, list(df.index)
    
    def sample(self, x, y, div_id, predict_other):
        predict_ref = self.vectorize_css(webpage)[0]
        self.model.eval()
        transformed = self.scaler.transform(np.array([[x, y]]))

        conversion_table = {
            'nav-main': 0,
            'hero-text': 1,
            'btn-cta': 2,
            'description': 3,
            'btn-cta-2': 4
        }

        new_attributes = []
        for row in predict_ref.loc[div_id].items():
            if predict_other is not None and row[0] in predict_other.keys() and type(predict_other[row[0]]) is int:
                new_attributes.append(predict_other[row[0]])
            else:
                new_attributes.append(row[1])
        
        bct = self.color_scaler.transform(np.array([[new_attributes[9], new_attributes[10], new_attributes[11]]]))
        ct = self.color_scaler.transform(np.array([[new_attributes[12], new_attributes[13], new_attributes[14]]]))
        st = self.size_scaler.transform(np.array([[new_attributes[0], new_attributes[1], new_attributes[2], new_attributes[3]]]))
        final_list = [transformed[0, 0], transformed[0, 1], conversion_table[div_id], st[0, 0], st[0, 1], st[0, 2], st[0, 3]] 
        final_list.extend(new_attributes[4:9])
        final_list.extend([bct[0, 0], bct[0, 1], bct[0, 2], ct[0,0], ct[0, 1], ct[0, 2]])
        final_list.extend(new_attributes[15:])

        count = self.model(torch.tensor(np.nan_to_num(final_list, nan=-1.0), dtype=torch.float32))
        print(f"[{x}, {y}, {div_id}]", count)

        return max(0, count.item())


if __name__ == '__main__':
    s = Sampler()
    print(s.sample(40, 140, 'hero-text', {"width": 180, "height": 180}))
    
import pandas as pd
import numpy as np
import random

def generate_synthetic_data(num_rows=500):
    data = []
    # Fixed seed for reproducibility
    np.random.seed(42)
    random.seed(42)

    def calculate_contrast(bg_r, bg_g, bg_b, fg_r, fg_g, fg_b):
        def lum(c):
            c = c / 255.0
            return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
        L1 = 0.2126 * lum(bg_r) + 0.7152 * lum(bg_g) + 0.0722 * lum(bg_b)
        L2 = 0.2126 * lum(fg_r) + 0.7152 * lum(fg_g) + 0.0722 * lum(fg_b)
        return (max(L1, L2) + 0.05) / (min(L1, L2) + 0.05)

    for i in range(num_rows):
        # 1. Assign Category
        cat = random.choice([0, 1, 2, 3, 4])
        
        # 2. Determine "Sweet Spot" (Target x,y) based on Category
        if cat == 0:   # Top-Left (Logo/Menu)
            center_x, center_y, sigma_x, sigma_y = 0, 0, 30, 30
        elif cat == 1: # Nav List (Top-Left quadrant)
            center_x, center_y, sigma_x, sigma_y = 40, 140, 40, 40
        elif cat == 2: # Context Menu (Mid-Left)
            center_x, center_y, sigma_x, sigma_y = 40, 240, 40, 60
        elif cat == 3: # Primary Action (Mid-Left/Center)
            center_x, center_y, sigma_x, sigma_y = 40, 300, 40, 40
        elif cat == 4: # FAB/Call-to-Action (Bottom-Right area)
            center_x, center_y, sigma_x, sigma_y = 120, 470, 50, 40

        # Generate Position with Noise
        x = max(0, int(np.random.normal(center_x, sigma_x)))
        y = max(0, int(np.random.normal(center_y, sigma_y)))

        # 3. Generate Dimensions (15% chance of being "bad/too small")
        if random.random() < 0.15:
            width = random.randint(20, 90)
            height = random.randint(10, 35)
        else:
            width = random.randint(100, 450)
            height = random.randint(45, 120)

        # 4. Generate Font Size & Colors
        fontSize = round(random.uniform(8, 11), 1) if random.random() < 0.15 else round(random.uniform(14, 28), 1)
        bg_r, bg_g, bg_b = random.randint(0, 255), random.randint(0, 255), random.randint(0, 255)
        
        # Color Logic: 15% chance of low contrast
        if random.random() < 0.15:
            fg_r = max(0, min(255, bg_r + random.randint(-40, 40)))
            fg_g = max(0, min(255, bg_g + random.randint(-40, 40)))
            fg_b = max(0, min(255, bg_b + random.randint(-40, 40)))
        else:
            # High contrast logic
            yiq = ((bg_r*299)+(bg_g*587)+(bg_b*114))/1000
            fg_r, fg_g, fg_b = (0,0,0) if yiq >= 128 else (255,255,255)

        # --- SCORING LOGIC (The "Ground Truth") ---
        base_score = 100
        
        # Distance Penalty (Euclidean or Manhatten based on shape)
        if cat == 0:
            dist = np.sqrt((x-0)**2 + (y-0)**2)
            score = base_score - (dist * 0.8) 
        elif cat == 1:
            dist = np.sqrt((x-40)**2 + (y-140)**2)
            score = base_score - (dist * 0.8)
        elif cat == 2:
            score = base_score - (abs(x - 40) * 0.5) - (abs(y - 240) * 0.6)
        elif cat == 3:
            dist = np.sqrt((x-40)**2 + (y-300)**2)
            score = base_score - (dist * 0.8)
        elif cat == 4:
            score = base_score - (abs(x - 120) * 0.84) - (abs(y - 470) * 0.8)

        # Feature Penalties
        if width < 100 or height < 40: score *= 0.1  # Too small
        if fontSize < 12: score *= 0.4               # Unreadable
        if calculate_contrast(bg_r, bg_g, bg_b, fg_r, fg_g, fg_b) < 3.0: score *= 0.1 # Low contrast

        # Finalize
        hits = int(max(0, min(100, score + random.uniform(-4, 4))))

        data.append([
            x, y, cat, x, y, width, height, 
            random.choice([16, 24]), fontSize, -1, -1, random.choice([0, 4, 8, 16]),
            bg_r, bg_g, bg_b, fg_r, fg_g, fg_b,
            1, 1, 1, 1, random.choice([0, 1]), random.choice([0, 1]), 1, hits
        ])

    columns = [
        "x","y","div_category","left","top","width","height","padding","fontSize","margin",
        "lineHeight","borderRadius","backgroundColor_R","backgroundColor_G","backgroundColor_B",
        "color_R","color_G","color_B","position_absolute","display_flex","alignItems_center",
        "boxSizing_border-box","fontWeight_bold","border_none","cursor_pointer","hits"
    ]
    
    return pd.DataFrame(data, columns=columns)

# Generate and print
df = generate_synthetic_data(500)
print(df.to_csv('synthetic_data.csv',index=False))

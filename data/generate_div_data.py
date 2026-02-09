import csv
import random
import numpy as np

NUM_POINTS = 500
STD_POS = 0.5
STD_CLICKS = 5

output_file = "test_data.csv"

# Anchor definitions
div0_anchors = [
    (5, 5, 50),
    (5, 100, 100),
    (50, 2, 25),
    (3, 200, 5),
]

div1_anchors = [
    (5, 5, 100),
    (3, 100, 30),
]

# Keep track of unique user IDs
used_user_ids = set()

def generate_unique_user_id():
    while True:
        uid = random.randint(100000, 999999)
        if uid not in used_user_ids:
            used_user_ids.add(uid)
            return uid

def sample_near(x, y, clicks):
    new_x = max(0, np.random.normal(x, STD_POS))
    new_y = max(0, np.random.normal(y, STD_POS))
    new_clicks = max(0, int(np.random.normal(clicks, STD_CLICKS)))
    return new_x, new_y, new_clicks

rows = []

for i in range(NUM_POINTS):
    div_id = random.randint(0, 4)

    if div_id == 0:
        anchor = random.choice(div0_anchors)
        x, y, clicks = sample_near(*anchor)

    elif div_id == 1:
        anchor = random.choice(div1_anchors)
        x, y, clicks = sample_near(*anchor)

    elif div_id == 2:
        # Bottom-heavy placement (y large)
        x = np.random.normal(50, STD_POS)
        y = np.random.normal(300, STD_POS)  # bottom
        clicks = max(0, int(np.random.normal(60, STD_CLICKS)))

    elif div_id == 3:
        # Low activity overall
        x = np.random.normal(25, STD_POS)
        y = np.random.normal(50, STD_POS)
        clicks = max(0, int(np.random.normal(5, 2)))

    else:  # div_id == 4
        # Fully random placement and clicks
        x = max(0, random.uniform(0, 300))
        y = max(0, random.uniform(0, 300))
        clicks = random.randint(0, 150)

    user_id = generate_unique_user_id()

    train_split = 1
    if i > (NUM_POINTS * 0.75):
        train_split = 0
     
    rows.append([x, y, div_id, user_id, clicks, train_split])

# Write CSV
with open(output_file, mode="w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["x", "y", "div id", "user id", "clicks", "train"])
    writer.writerows(rows)

print(f"{NUM_POINTS} data points written to {output_file}")

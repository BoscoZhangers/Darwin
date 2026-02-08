<div align="center">
  <img src="public/favicon.svg" width="200" />
</div>

<h1 align = "center">
    Darwin
</h1>

<div align = "center"> Websites used to be static. Now they undergo natural selection. </div>

<br>
<br>

## 🚀 Key Features

### 🌌 Gravity-Well Visualization
Component interactions (clicks/engagement) are tracked in real-time. Each component is represented as a "gravity well" in a 3D simulation.
* **Dynamic Scaling**: Spheres grow in size proportionally to their interaction count.
* **Focus Zoom**: Double-click any gravity well to zoom the camera in and reveal the component's internal property fields.

### 🪄 AI Assistant (Powered by Gemini)
Directly modify your code using natural language. The integrated AI panel allows you to request UI changes and preview them instantly before committing.

### 🛠️ Runtime Renderer & Editor
* **Live Extraction**: Drag elements directly from the live preview into the tracking environment to begin monitoring them.
* **Syntax-Highlighted Editor**: A full-featured editor workspace with GitHub sync and commit capabilities.
* **Theming**: Toggle between high-contrast Dark and Light modes for both the 3D scene and the analytics panels.

## 🛠️ Tech Stack

* **Frontend**: React, Tailwind CSS, Lucide React
* **3D Engine**: Three.js, React Three Fiber, React Three Drei
* **AI**: Google Gemini 2.0
* **Backend/Auth**: Firebase (Swarm Subscription), Octokit (GitHub API)
* **Post-processing**: Bloom, Vignette (EffectComposer)

## 📦 Getting Started

1. **Clone the repository**
   ```bash
   git clone [https://github.com/BoscoZhangers/Darwin.git](https://github.com/BoscoZhangers/Darwin.git)
    ```
2. Install dependencies
    ```bash
   npm install
    ```
3. Configure Environment Variables
   Create a .env file with your Firebase and GitHub API credentials.
   
3. Run the development server
   ```bash
    npm run dev
   ```

## 🧠 Evolutionary Vision
Darwin treats code as a living organism. By visualizing the "heartbeat" of a component through interactions, developers can identify bottlenecks and optimize UX flow through a spatial lens rather than a flat line of text.

import express from 'express';
import cors from 'cors'; // Required to allow your frontend to talk to the backend
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv'; // loads .env automatically

const app = express();
const PORT = 3001; // Matches the port your frontend is looking for

// 1. Setup Middleware
app.use(cors()); 
app.use(express.json());

dotenv.config({ path: ".env.local" });

const apiKey = process.env.GOOGLE_API_KEY_DARWIN;

// 2. Initialize Gemini (Replace 'YOUR_API_KEY' with your actual key)
const genAI = new GoogleGenerativeAI(apiKey);

app.post('/api/generate_code', async (req, res) => {
    try {
      const { prompt, code } = req.body;
      
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
      const fullPrompt = `
        You are an expert React developer. 
        Update this App.jsx code based on this request: "${prompt}"
        EXISTING CODE: ${code}
        Return ONLY the raw code string. No markdown.
      `;
  
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();
  
      res.json({ code: text.replace(/```jsx|```/g, "").trim() });
  
    } catch (error) {
      console.error("❌ SERVER CRASH DETAILS:");
      console.error("Message:", error.message);
      res.status(500).json({ error: error.message });
    }
});

// 3. START THE SERVER (This is why you were getting a connection error)
app.listen(PORT, () => {
    console.log(`✅ Backend is running at http://localhost:${PORT}`);
});
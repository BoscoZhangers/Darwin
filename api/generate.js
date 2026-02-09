import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // Manual CORS for Vercel Functions
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prompt, code } = req.body;
    
    // Ensure GOOGLE_API_KEY_DARWIN is set in Vercel
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY_DARWIN);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const fullPrompt = `
      You are an expert React developer. 
      Update this App.jsx code based on this request: "${prompt}"
      EXISTING CODE: ${code}
      Return ONLY the raw code string. No markdown.
    `;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ code: text.replace(/```jsx|```/g, "").trim() });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
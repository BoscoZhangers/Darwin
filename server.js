// Inside your app.post('/api/generate_code', ...) block in server.js

app.post('/api/generate_code', async (req, res) => {
    try {
      const { prompt, code } = req.body;
      
      // Use the official Gemini 3 Flash identifier
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash" });
  
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
      // This logs the ACTUAL reason to your terminal
      console.error("❌ SERVER CRASH DETAILS:");
      console.error("Message:", error.message);
      
      // Check if it's an API Key or Region issue
      if (error.status === 403 || error.status === 401) {
          console.error("Critical: Your API Key is invalid or restricted.");
      }
  
      res.status(500).json({ error: error.message });
    }
  });
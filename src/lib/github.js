// src/lib/github.js

// Access the variable securely
const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN; 

// Safety check
if (!GITHUB_TOKEN) {
  console.error("Missing GitHub Token! Check your .env file.");
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });
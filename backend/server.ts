// src/server.ts
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config(); // Load .env file

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json()); // Middleware to parse JSON bodies

// Simple welcome route
app.get('/api', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to the API!' });
});

// Add other routes here...

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});

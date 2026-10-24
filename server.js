
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import scholarshipRoutes from './routes/scholarshipRoutes.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', scholarshipRoutes);

// Serve the homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

console.log(
  process.env.GEMINI_API_KEY
    ? 'Gemini API key loaded'
    : 'Gemini API key missing'
);

export default app;

// Run a local server only when started directly
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`AccessLens running at http://localhost:${PORT}`);
  });
}

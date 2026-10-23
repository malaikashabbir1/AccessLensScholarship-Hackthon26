
import 'dotenv/config';
import express from 'express';
import scholarshipRoutes from './routes/scholarshipRoutes.js';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

console.log(
  process.env.GEMINI_API_KEY
    ? 'Gemini API key loaded'
    : 'Gemini API key missing'
);

app.use('/api', scholarshipRoutes);

app.listen(PORT, () => {
  console.log(`AccessLens server running at http://localhost:${PORT}`);
});



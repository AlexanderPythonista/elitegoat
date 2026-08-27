import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import organizationRoutes from './routes/organizations.js';
import coordinationRoutes from './routes/coordinations.js';
import personRoutes from './routes/persons.js';
import userRoutes from './routes/users.js';
import rankingRoutes from './routes/ranking.js';
import topRoutes from './routes/top.js';
import formRoutes from './routes/forms.js'; // NUEVO

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/coordinations', coordinationRoutes);
app.use('/api/persons', personRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ranking', rankingRoutes);
app.use('/api/top', topRoutes);
app.use('/api/forms', formRoutes); // NUEVO

app.get('/health', (req, res) => res.json({ status: 'OK' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Error interno', error: err.message });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/form', (req, res) => { // NUEVO: vista pública de formularios
  res.sendFile(path.join(__dirname, 'public', 'form.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});
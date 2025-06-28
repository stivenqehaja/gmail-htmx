import express from 'express';
import session from 'express-session';
import SQLiteStore from 'connect-sqlite3';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import emailRoutes from './routes/emails.js';
import { sessionConfig } from './config/session.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const SQLiteStoreSession = SQLiteStore(session);

// Middleware
app.use(express.static('public'));
app.use(express.static('static'));
app.set('view-engine', 'ejs');
app.use(express.json());
app.use(session(sessionConfig(SQLiteStoreSession)));

// Routes
app.use('/', authRoutes);
app.use('/', emailRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
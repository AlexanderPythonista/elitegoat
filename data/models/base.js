import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

async function ensureDirectories() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creando directorios:', error);
  }
}

export async function readJSON(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function writeJSON(fileName, data) {
  const filePath = path.join(DATA_DIR, fileName);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export function findById(array, id) {
  return array.find(item => item.id === id);
}

export function removeById(array, id) {
  const index = array.findIndex(item => item.id === id);
  if (index !== -1) {
    array.splice(index, 1);
    return true;
  }
  return false;
}

export async function initDataFiles() {
  await ensureDirectories();
  const users = await readJSON('users.json');
  if (users.length === 0) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = {
      id: uuidv4(),
      username: 'root',
      email: 'root@eventpro.com',
      password: hashedPassword,
      role: 'root',
      isActive: true,
      createdAt: new Date().toISOString()
    };
    await writeJSON('users.json', [admin]);
    console.log('✅ Usuario root creado: root / admin123');
  }

  // Crear archivos si no existen (sin participants.json)
  const files = ['events.json', 'organizations.json', 'coordinations.json', 'persons.json', 'logs.json', 'top.json'];
  for (const file of files) {
    try { await readJSON(file); } catch { await writeJSON(file, []); }
  }
}
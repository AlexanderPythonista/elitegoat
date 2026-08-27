import { TopPlayer } from '../models/TopPlayer.js';
import { Log } from '../models/Log.js';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.join(__dirname, '../temp');

// Asegurar que temp existe
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export const getTopPlayers = async (req, res) => {
  try {
    const players = await TopPlayer.findAll();
    res.json({ success: true, data: players });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createTopPlayer = async (req, res) => {
  try {
    const player = await TopPlayer.create(req.body);
    await Log.create({
      userId: req.user.id,
      action: 'create_top_player',
      target: player.id,
      details: req.body
    });
    res.status(201).json({ success: true, data: player });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTopPlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await TopPlayer.update(id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'No encontrado' });
    await Log.create({
      userId: req.user.id,
      action: 'update_top_player',
      target: id,
      details: req.body
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTopPlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await TopPlayer.delete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'No encontrado' });
    await Log.create({
      userId: req.user.id,
      action: 'delete_top_player',
      target: id
    });
    res.json({ success: true, message: 'Eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const importTopPlayers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se subió ningún archivo' });
    }
    // Leer el archivo Excel
    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    // Validar y transformar
    const players = data.map(row => ({
      id: row.ID || '',
      name: row.NAME || '',
      almacenActual: row['ALMACEN ACTUAL'] || '',
      num: row.NUM || '',
      rango: row.RANGO || '',
      clan: row.CLAN || 'FUERA DEL CLAN',
      prevAlmacen: row['PREV ALMACEN'] || '',
      nacionalidad: row.NACIONALIDAD || '',
      horas: row.HORAS || '',
      rango2: row.RANGO2 || '',
      rango3: row.RANGO3 || '',
      jugadores: row.JUGADORES || ''
    }));

    // Eliminar todos los existentes y guardar los nuevos
    await TopPlayer.deleteAll();
    for (const p of players) {
      await TopPlayer.create(p);
    }

    // Eliminar archivo temporal
    fs.unlinkSync(req.file.path);

    await Log.create({
      userId: req.user.id,
      action: 'import_top_players',
      details: { count: players.length }
    });

    res.json({ success: true, message: `Se importaron ${players.length} jugadores` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const exportTopPlayers = async (req, res) => {
  try {
    const players = await TopPlayer.findAll();
    // Preparar datos para Excel
    const data = players.map(p => ({
      ID: p.id || '',
      NAME: p.name || '',
      'ALMACEN ACTUAL': p.almacenActual || '',
      NUM: p.num || '',
      RANGO: p.rango || '',
      CLAN: p.clan || '',
      'PREV ALMACEN': p.prevAlmacen || '',
      NACIONALIDAD: p.nacionalidad || '',
      HORAS: p.horas || '',
      RANGO2: p.rango2 || '',
      RANGO3: p.rango3 || '',
      JUGADORES: p.jugadores || ''
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, 'TOP');
    const filePath = path.join(TEMP_DIR, `top_export_${Date.now()}.xlsx`);
    xlsx.writeFile(wb, filePath);

    res.download(filePath, 'top_players.xlsx', (err) => {
      if (err) console.error(err);
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
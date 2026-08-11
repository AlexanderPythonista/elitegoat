import { readJSON, writeJSON, findById, removeById } from './base.js';
import { v4 as uuidv4 } from 'uuid';

const FILE = 'topplayers.json';

export const TopPlayer = {
  async findAll() {
    return await readJSON(FILE);
  },

  async findById(id) {
    const players = await this.findAll();
    return findById(players, id);
  },

  async create(data) {
    const players = await this.findAll();
    const newPlayer = {
      id: uuidv4(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    players.push(newPlayer);
    await writeJSON(FILE, players);
    return newPlayer;
  },

  async update(id, updateData) {
    const players = await this.findAll();
    const player = findById(players, id);
    if (!player) return null;
    Object.assign(player, updateData, { updatedAt: new Date().toISOString() });
    await writeJSON(FILE, players);
    return player;
  },

  async delete(id) {
    const players = await this.findAll();
    const removed = removeById(players, id);
    if (removed) {
      await writeJSON(FILE, players);
      return true;
    }
    return false;
  },

  // Eliminar todos (para importar)
  async deleteAll() {
    await writeJSON(FILE, []);
    return true;
  }
};
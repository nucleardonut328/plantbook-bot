import fs from 'fs';
import path from 'path';

const DATA_DIR = '/app/data';
const DATA_FILE = path.join(DATA_DIR, 'plants.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const defaults = [
  { id: 1, name: 'Монстера', latin_name: 'Monstera deliciosa', category: 'Комнатные', light: 'Рассеянный свет', water: 'Умеренно', temp: '20-25°C', description: 'Популярное комнатное растение с крупными листьями.', user_id: null, last_watered: null },
  { id: 2, name: 'Замиокулькас', latin_name: 'Zamioculcas zamiifolia', category: 'Суккуленты', light: 'Тень', water: 'Редко', temp: '18-26°C', description: 'Неубиваемое растение, переносит засуху и тень.', user_id: null, last_watered: null },
  { id: 3, name: 'Фикус', latin_name: 'Ficus lyrata', category: 'Комнатные', light: 'Яркий свет', water: 'Умеренно', temp: '18-24°C', description: 'Красивое растение с крупными скрипичными листьями.', user_id: null, last_watered: null }
];

let db = { plants: [], notes: [], nextPlantId: 4, nextNoteId: 1 };

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    else { db.plants = [...defaults]; save(); }
  } catch (e) { db.plants = [...defaults]; }
}
function save() { try { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); } catch (e) {} }

load();

export const getPlants = (userId) => db.plants.filter(p => p.user_id === null || p.user_id === userId);
export const getPlant = (id) => db.plants.find(p => p.id === Number(id));
export const searchPlants = (q) => {
  const qq = q.toLowerCase();
  return db.plants.filter(p => p.name.toLowerCase().includes(qq) || p.latin_name.toLowerCase().includes(qq));
};
export const addPlant = (p) => {
  const plant = { ...p, id: db.nextPlantId++, created_at: new Date().toISOString() };
  db.plants.push(plant); save(); return plant;
};
export const deletePlant = (id, userId) => {
  const i = db.plants.findIndex(p => p.id === Number(id) && p.user_id === userId);
  if (i === -1) return false;
  db.notes = db.notes.filter(n => n.plant_id !== Number(id));
  db.plants.splice(i, 1); save(); return true;
};
export const updateLastWatered = (id, date) => {
  const p = db.plants.find(p => p.id === Number(id));
  if (p) { p.last_watered = date; save(); }
};
export const addNote = (plantId, userId, text) => {
  const n = { id: db.nextNoteId++, plant_id: Number(plantId), user_id: userId, text, created_at: new Date().toLocaleString('ru-RU') };
  db.notes.push(n); save(); return n;
};
export const getNotes = (plantId) => db.notes.filter(n => n.plant_id === Number(plantId)).sort((a, b) => b.id - a.id);

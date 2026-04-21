import Database from 'better-sqlite3';

const db = new Database('plantbook.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS plants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    latin_name TEXT,
    category TEXT DEFAULT 'Лиственные',
    light TEXT,
    water TEXT,
    temp TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id INTEGER,
    user_id INTEGER,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Демо-растения
const count = db.prepare('SELECT COUNT(*) as c FROM plants').get();
if (count.c === 0) {
  const insert = db.prepare(`
    INSERT INTO plants (user_id, name, latin_name, category, light, water, temp, description)
    VALUES (0, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run('Монстера', 'Monstera deliciosa', 'Лиственные', 'Яркий рассеянный', 'Раз в неделю', '18-25°C', 'Популярное растение с разрезными листьями');
  insert.run('Замиокулькас', 'Zamioculcas zamiifolia', 'Суккуленты', 'Любой', 'Раз в 3 недели', '15-30°C', 'Идеально для начинающих');
  insert.run('Фикус', 'Ficus lyrata', 'Деревья', 'Яркий прямой', 'Раз в 10 дней', '20-30°C', 'Эффектное растение с крупными листьями');
}

export const getPlants = (userId) =>
  db.prepare('SELECT * FROM plants WHERE user_id = ? OR user_id = 0').all(userId);

export const getPlant = (id) =>
  db.prepare('SELECT * FROM plants WHERE id = ?').get(id);

export const searchPlants = (query) =>
  db.prepare('SELECT * FROM plants WHERE name LIKE ? OR latin_name LIKE ?')
    .all(`%${query}%`, `%${query}%`);

export const addPlant = (plant) =>
  db.prepare(`INSERT INTO plants (user_id, name, latin_name, category, light, water, temp, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(plant.user_id, plant.name, plant.latin_name, plant.category, plant.light, plant.water, plant.temp, plant.description);

export const getNotes = (plantId) =>
  db.prepare('SELECT * FROM notes WHERE plant_id = ? ORDER BY created_at DESC').all(plantId);

export const addNote = (plantId, userId, text) =>
  db.prepare('INSERT INTO notes (plant_id, user_id, text) VALUES (?, ?, ?)')
    .run(plantId, userId, text);

import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import express from 'express';
import { getPlants, getPlant, searchPlants, addNote, getNotes } from './db.js';
import { analyzePlant } from './groq.js';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
const sessions = {};

const getSession = (id) => {
  if (!sessions[id]) sessions[id] = {};
  return sessions[id];
};

const mainKeyboard = Markup.keyboard([
  ['📚 Каталог', '🔍 Поиск'],
  ['📝 Заметки', '🤖 AI Анализ']
]).resize();

// Старт
bot.start((ctx) => ctx.reply(
  '🌿 *PlantBook Bot*\n\nПомощник по уходу за растениями!',
  { parse_mode: 'Markdown', ...mainKeyboard }
));

// Каталог
bot.hears('📚 Каталог', async (ctx) => {
  const plants = getPlants(ctx.from.id);
  const buttons = plants.map(p => [Markup.button.callback(`🌿 ${p.name}`, `plant_${p.id}`)]);
  await ctx.reply('📚 Ваши растения:', Markup.inlineKeyboard(buttons));
});

// Поиск
bot.hears('🔍 Поиск', (ctx) => {
  getSession(ctx.from.id).search = true;
  ctx.reply('🔍 Введите название растения:');
});

// Заметки
bot.hears('📝 Заметки', async (ctx) => {
  const plants = getPlants(ctx.from.id);
  const buttons = plants.map(p => [Markup.button.callback(`🌿 ${p.name}`, `notes_${p.id}`)]);
  await ctx.reply('📝 Выберите растение:', Markup.inlineKeyboard(buttons));
});

// AI Анализ
bot.hears('🤖 AI Анализ', async (ctx) => {
  const plants = getPlants(ctx.from.id);
  const buttons = plants.map(p => [Markup.button.callback(`🌿 ${p.name}`, `ai_${p.id}`)]);
  await ctx.reply('🤖 Выберите растение для анализа:', Markup.inlineKeyboard(buttons));
});

// Карточка растения
bot.action(/plant_(\d+)/, async (ctx) => {
  const plant = getPlant(ctx.match[1]);
  await ctx.answerCbQuery();
  await ctx.reply(
    `🌿 *${plant.name}*\n_${plant.latin_name}_\n\n` +
    `📂 ${plant.category}\n☀️ ${plant.light}\n💧 ${plant.water}\n🌡️ ${plant.temp}\n\n${plant.description}`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📝 Заметки', `notes_${plant.id}`)],
        [Markup.button.callback('🤖 AI Анализ', `ai_${plant.id}`)]
      ])
    }
  );
});

// Просмотр заметок
bot.action(/notes_(\d+)/, async (ctx) => {
  const plant = getPlant(ctx.match[1]);
  const notes = getNotes(ctx.match[1]);
  await ctx.answerCbQuery();
  let text = `📝 *Заметки — ${plant.name}*\n\n`;
  text += notes.length ? notes.map((n, i) => `${i+1}. ${n.text}\n_${n.created_at}_`).join('\n\n') : '_Заметок пока нет_';
  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('➕ Добавить заметку', `addnote_${plant.id}`)]
    ])
  });
});

// Добавить заметку
bot.action(/addnote_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  getSession(ctx.from.id).addNote = ctx.match[1];
  await ctx.reply('✏️ Напишите заметку:');
});

// AI анализ
bot.action(/ai_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery('🤖 Анализирую...');
  const plant = getPlant(ctx.match[1]);
  await ctx.reply('⏳ Анализирую растение...');
  const analysis = await analyzePlant(plant);
  await ctx.reply(`🌿 *${plant.name}*\n\n🤖 *AI Анализ:*\n\n${analysis}`, { parse_mode: 'Markdown' });
});

// Текстовые сообщения
bot.on('text', async (ctx) => {
  const session = getSession(ctx.from.id);

  if (session.search) {
    session.search = false;
    const plants = searchPlants(ctx.message.text);
    if (!plants.length) return ctx.reply('❌ Ничего не найдено.');
    const buttons = plants.map(p => [Markup.button.callback(`🌿 ${p.name}`, `plant_${p.id}`)]);
    return ctx.reply('🔍 Результаты:', Markup.inlineKeyboard(buttons));
  }

  if (session.addNote) {
    const plantId = session.addNote;
    session.addNote = null;
    addNote(plantId, ctx.from.id, ctx.message.text);
    return ctx.reply('✅ Заметка сохранена!', mainKeyboard);
  }
});

// Express + Webhook
app.use(express.json());
app.use(bot.webhookCallback('/webhook'));
app.get('/', (_, res) => res.send('🌿 PlantBook Bot работает!'));
app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🌿 Запущен на порту ${PORT}`);
  if (process.env.WEBHOOK_URL) {
    await bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}/webhook`);
    console.log(`🔗 Webhook: ${process.env.WEBHOOK_URL}/webhook`);
  }
});

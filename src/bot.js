import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import express from 'express';
import { getPlants, getPlant, searchPlants, addNote, getNotes, addPlant, deletePlant, updateLastWatered } from './db.js';
import { analyzePlant, getCareTips, diagnoseProblem } from './groq.js';

dotenv.config();
const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
const sessions = {};
const getS = (id) => sessions[id] || (sessions[id] = {});

const mainKeyboard = Markup.keyboard([
  ['📚 Каталог', '🔍 Поиск'],
  ['➕ Добавить растение', '🗑 Удалить'],
  ['📝 Заметки', '💧 Полив'],
  ['🤖 AI Анализ', '💡 AI Советы'],
  ['🆘 AI Помощник']
]).resize();

// ====== КОМАНДЫ ======
bot.start((ctx) => ctx.reply('🌿 *PlantBook 2.0*\n\nДобавляйте растения, следите за поливом, получайте AI-советы и диагностику!', { parse_mode: 'Markdown', ...mainKeyboard }));

bot.hears('📚 Каталог', async (ctx) => {
  const plants = getPlants(ctx.from.id);
  if (!plants.length) return ctx.reply('📭 Пока пусто. Добавьте первое растение ➕', mainKeyboard);
  const btns = plants.map(p => [Markup.button.callback(`🌿 ${p.name}`, `plant_${p.id}`)]);
  await ctx.reply('📚 Ваши растения:', Markup.inlineKeyboard(btns));
});

bot.hears('🔍 Поиск', (ctx) => { getS(ctx.from.id).search = true; ctx.reply('🔍 Введите название:', Markup.removeKeyboard()); });

bot.hears('➕ Добавить растение', (ctx) => {
  getS(ctx.from.id).adding = { step: 'name', data: {} };
  ctx.reply('➕ *Новое растение*\n\nШаг 1/7: Название:', { parse_mode: 'Markdown', ...Markup.removeKeyboard() });
});

bot.hears('🗑 Удалить', async (ctx) => {
  const plants = getPlants(ctx.from.id).filter(p => p.user_id === ctx.from.id);
  if (!plants.length) return ctx.reply('❌ Нет ваших растений для удаления.', mainKeyboard);
  const btns = plants.map(p => [Markup.button.callback(`🗑 ${p.name}`, `del_${p.id}`)]);
  await ctx.reply('🗑 Выберите:', Markup.inlineKeyboard(btns));
});

bot.hears('📝 Заметки', async (ctx) => {
  const plants = getPlants(ctx.from.id);
  if (!plants.length) return ctx.reply('📭 Нет растений.', mainKeyboard);
  const btns = plants.map(p => [Markup.button.callback(`🌿 ${p.name}`, `notes_${p.id}`)]);
  await ctx.reply('📝 Выберите растение:', Markup.inlineKeyboard(btns));
});

bot.hears('💧 Полив', async (ctx) => {
  const plants = getPlants(ctx.from.id);
  if (!plants.length) return ctx.reply('📭 Нет растений.', mainKeyboard);
  const btns = plants.map(p => [Markup.button.callback(`${p.last_watered ? '💧' : '⚠️'} ${p.name}`, `water_${p.id}`)]);
  await ctx.reply('💧 Выберите растение:', Markup.inlineKeyboard(btns));
});

bot.hears('🤖 AI Анализ', async (ctx) => {
  const plants = getPlants(ctx.from.id);
  if (!plants.length) return ctx.reply('📭 Нет растений.', mainKeyboard);
  const btns = plants.map(p => [Markup.button.callback(`🌿 ${p.name}`, `ai_${p.id}`)]);
  await ctx.reply('🤖 Выберите растение:', Markup.inlineKeyboard(btns));
});

bot.hears('💡 AI Советы', async (ctx) => {
  const plants = getPlants(ctx.from.id);
  if (!plants.length) return ctx.reply('📭 Нет растений. Добавьте хотя бы одно.', mainKeyboard);
  const btns = plants.map(p => [Markup.button.callback(`🌿 ${p.name}`, `tips_${p.id}`)]);
  await ctx.reply('💡 Выберите растение для персональных советов:', Markup.inlineKeyboard(btns));
});

bot.hears('🆘 AI Помощник', (ctx) => {
  getS(ctx.from.id).helper = { step: 'plant' };
  ctx.reply('🆘 *AI Помощник по диагностике*\n\nШаг 1/5: Какое растение? (название)', { parse_mode: 'Markdown', ...Markup.removeKeyboard() });
});

// ====== INLINE: карточка / заметки / полив / ai / советы ======
bot.action(/plant_(\d+)/, async (ctx) => {
  const p = getPlant(ctx.match[1]); if (!p) return ctx.answerCbQuery('❌ Не найдено');
  await ctx.answerCbQuery();
  const w = p.last_watered ? `\n💧 Полив: ${new Date(p.last_watered).toLocaleDateString('

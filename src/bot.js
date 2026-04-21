import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import express from 'express';
import { getPlants, getPlant, searchPlants, addNote, getNotes, addPlant, deletePlant, updateLastWatered } from './db.js';
import { analyzePlant } from './groq.js';

dotenv.config();
const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
const sessions = {};
const getS = (id) => sessions[id] || (sessions[id] = {});

const mainKeyboard = Markup.keyboard([
  ['📚 Каталог', '🔍 Поиск'],
  ['➕ Добавить растение', '🗑 Удалить'],
  ['📝 Заметки', '💧 Полив'],
  ['🤖 AI Анализ', '💡 Советы']
]).resize();

// ====== КОМАНДЫ ======
bot.start((ctx) => ctx.reply('🌿 *PlantBook 2.0*\n\nДобавляйте свои растения, следите за поливом и получайте AI-советы!', { parse_mode: 'Markdown', ...mainKeyboard }));

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

bot.hears('💡 Советы', (ctx) => ctx.reply('💡 *Категории советов:*', {
  parse_mode: 'Markdown',
  ...Markup.inlineKeyboard([
    [Markup.button.callback('💧 Полив', 'tip_w'), Markup.button.callback('☀️ Свет', 'tip_l')],
    [Markup.button.callback('🌱 Пересадка', 'tip_r'), Markup.button.callback('🧪 Удобрения', 'tip_f')],
    [Markup.button.callback('🐛 Вредители', 'tip_p'), Markup.button.callback('🏠 Общие', 'tip_g')]
  ])
}));

// ====== INLINE: карточка / заметки / полив / ai ======
bot.action(/plant_(\d+)/, async (ctx) => {
  const p = getPlant(ctx.match[1]); if (!p) return ctx.answerCbQuery('❌ Не найдено');
  await ctx.answerCbQuery();
  const w = p.last_watered ? `\n💧 Полив: ${new Date(p.last_watered).toLocaleDateString('ru-RU')}` : '';
  await ctx.reply(`🌿 *${p.name}*\n_${p.latin_name}_\n📂 ${p.category}\n☀️ ${p.light}\n💧 ${p.water}\n🌡️ ${p.temp}${w}\n\n${p.description}`, {
    parse_mode: 'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('📝 Заметки', `notes_${p.id}`), Markup.button.callback('💧 Полить', `dw_${p.id}`)],
      [Markup.button.callback('🤖 AI Анализ', `ai_${p.id}`)]
    ])
  });
});

bot.action(/notes_(\d+)/, async (ctx) => {
  const p = getPlant(ctx.match[1]); const n = getNotes(ctx.match[1]);
  await ctx.answerCbQuery();
  let t = `📝 *Заметки — ${p.name}*\n\n`;
  t += n.length ? n.map((x, i) => `${i+1}. ${x.text}\n_${x.created_at}_`).join('\n\n') : '_Заметок нет_';
  await ctx.reply(t, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('➕ Добавить', `addn_${p.id}`)]]) });
});

bot.action(/addn_(\d+)/, async (ctx) => { await ctx.answerCbQuery(); getS(ctx.from.id).addNote = ctx.match[1]; await ctx.reply('✏️ Напишите заметку:'); });

bot.action(/del_(\d+)/, async (ctx) => {
  const p = getPlant(ctx.match[1]); if (!p) return ctx.answerCbQuery('❌ Не найдено');
  await ctx.answerCbQuery();
  await ctx.reply(`🗑 Удалить *${p.name}*?`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
    [Markup.button.callback('✅ Да', `cdel_${p.id}`), Markup.button.callback('❌ Нет', 'cancel')]
  ])});
});

bot.action(/cdel_(\d+)/, async (ctx) => {
  const ok = deletePlant(ctx.match[1], ctx.from.id);
  await ctx.answerCbQuery(ok ? '✅ Удалено' : '❌ Ошибка');
  await ctx.reply(ok ? '✅ Растение удалено.' : '❌ Не удалось удалить.', mainKeyboard);
});

bot.action('cancel', async (ctx) => { await ctx.answerCbQuery('Отменено'); await ctx.reply('❌ Отменено.', mainKeyboard); });

bot.action(/water_(\d+)/, async (ctx) => {
  const p = getPlant(ctx.match[1]); if (!p) return ctx.answerCbQuery('❌ Не найдено');
  await ctx.answerCbQuery();
  const last = p.last_watered ? new Date(p.last_watered).toLocaleDateString('ru-RU') : 'неизвестно';
  const days = p.water.includes('Часто') ? 2 : p.water.includes('Редко') ? 14 : 7;
  const next = p.last_watered ? new Date(Date.parse(p.last_watered) + days*864e5).toLocaleDateString('ru-RU') : 'неизвестно';
  await ctx.reply(`💧 *${p.name}*\nПоследний полив: ${last}\nРекомендуемый следующий: ${next}`, {
    parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('💧 Полить сейчас', `dw_${p.id}`)]])
  });
});

bot.action(/dw_(\d+)/, async (ctx) => {
  const p = getPlant(ctx.match[1]); if (!p) return ctx.answerCbQuery('❌ Не найдено');
  updateLastWatered(ctx.match[1], new Date().toISOString());
  const days = p.water.includes('Часто') ? 2 : p.water.includes('Редко') ? 14 : 7;
  await ctx.answerCbQuery('💧 Полито!');
  await ctx.reply(`✅ *${p.name}* полито!\nСледующий полив примерно через ${days} дней.`, { parse_mode: 'Markdown', ...mainKeyboard });
});

bot.action(/ai_(\d+)/, async (ctx) => {
  const p = getPlant(ctx.match[1]); if (!p) return ctx.answerCbQuery('❌ Не найдено');
  await ctx.answerCbQuery('🤖 Анализирую...');
  await ctx.reply('⏳ Анализирую...');
  const a = await analyzePlant(p);
  await ctx.reply(`🌿 *${p.name}*\n\n🤖 *AI Анализ:*\n\n${a}`, { parse_mode: 'Markdown' });
});

// ====== СОВЕТЫ ======
const tips = {
  tip_w: `💧 *Полив*\n• Поливайте утром отстоянной водой\n• Лучше недолить, чем перелить\n• Зимой поливайте в 2 раза реже\n• Проверяйте влажность пальцем`,
  tip_l: `☀️ *Освещение*\n• Яркий рассеянный свет — идеал\n• Поворачивайте горшок раз в неделю\n• Тенелюбивые тоже нуждаются в свете\n• Зимой используйте фитолампы`,
  tip_r: `🌱 *Пересадка*\n• Пересаживайте весной\n• Новый горшок на 2-3 см больше\n• Обязательно дренажное отверстие\n• Не поливайте 2-3 дня после`,
  tip_f: `🧪 *Удобрения*\n• Удобряйте только весной-летом\n• Соблюдайте дозировку\n• Не удобряйте после пересадки\n• Чередуйте минеральные и органические`,
  tip_p: `🐛 *Вредители*\n• Паутинный клещ — мыльный раствор\n• Щитовка — спирт + вата\n• Тля — струя воды или чеснок\n• Протирайте листья для профилактики`,
  tip_g: `🏠 *Общие советы*\n• Стабильность важнее идеальных условий\n• Желтые листья = часто переизбыток воды\n• Сухие кончики = низкая влажность\n• Следите за состоянием листьев`
};
Object.entries(tips).forEach(([a, t]) => bot.action(a, async (ctx) => { await ctx.answerCbQuery(); await ctx.reply(t, { parse_mode: 'Markdown', ...mainKeyboard }); }));

// ====== ТЕКСТ ======
bot.on('text', async (ctx) => {
  const s = getS(ctx.from.id), txt = ctx.message.text;

  if (s.adding) {
    const { step, data } = s.adding;
    if (step === 'name') { data.name = txt; s.adding.step = 'latin'; return ctx.reply('Шаг 2/7: Латинское название (или "нет"):'); }
    if (step === 'latin') { data.latin_name = txt === 'нет' ? '—' : txt; s.adding.step = 'cat'; return ctx.reply('Шаг 3/7: Категория:', Markup.inlineKeyboard([
      [Markup.button.callback('🏠 Комнатные', 'c_Комнатные'), Markup.button.callback('🌵 Суккуленты', 'c_Суккуленты')],
      [Markup.button.callback('🌹 Садовые', 'c_Садовые'), Markup.button.callback('🌿 Другие', 'c_Другие')]
    ])); }
    if (step === 'desc') { data.description = txt; data.user_id = ctx.from.id; const p = addPlant(data); s.adding = null; return ctx.reply(`✅ Добавлено: *${p.name}*`, { parse_mode: 'Markdown', ...mainKeyboard }); }
    return;
  }

  if (s.search) { s.search = false; const ps = searchPlants(txt); if (!ps.length) return ctx.reply('❌ Не найдено.', mainKeyboard); const btns = ps.map(p => [Markup.button.callback(`🌿 ${p.name}`, `plant_${p.id}`)]); return ctx.reply('🔍 Результаты:', Markup.inlineKeyboard(btns)); }
  if (s.addNote) { const id = s.addNote; s.addNote = null; addNote(id, ctx.from.id, txt); return ctx.reply('✅ Заметка сохранена!', mainKeyboard); }

  ctx.reply('Используйте меню 👇', mainKeyboard);
});

// inline для добавления растения
bot.action(/c_(.+)/, async (ctx) => { const s = getS(ctx.from.id); if (!s.adding) return; s.adding.data.category = ctx.match[1]; s.adding.step = 'light'; await ctx.answerCbQuery(); await ctx.reply('Шаг 4/7: Освещение:', Markup.inlineKeyboard([[Markup.button.callback('☀️ Яркий', 'l_Яркий свет'), Markup.button.callback('🌤 Рассеянный', 'l_Рассеянный свет'), Markup.button.callback('🌑 Тень', 'l_Тень')]])); });
bot.action(/l_(.+)/, async (ctx) => { const s = getS(ctx.from.id); if (!s.adding) return; s.adding.data.light = ctx.match[1]; s.adding.step = 'water'; await ctx.answerCbQuery(); await ctx.reply('Шаг 5/7: Полив:', Markup.inlineKeyboard([[Markup.button.callback('💧 Часто', 'wa_Часто'), Markup.button.callback('💧 Умеренно', 'wa_Умеренно'), Markup.button.callback('🌵 Редко', 'wa_Редко')]])); });
bot.action(/wa_(.+)/, async (ctx) => { const s = getS(ctx.from.id); if (!s.adding) return; s.adding.data.water = ctx.match[1]; s.adding.step = 'temp'; await ctx.answerCbQuery(); await ctx.reply('Шаг 6/7: Температура:', Markup.inlineKeyboard([[Markup.button.callback('🔥 22-28°', 't_22-28°C'), Markup.button.callback('🌡️ 18-24°', 't_18-24°C'), Markup.button.callback('❄️ 15-20°', 't_15-20°C')]])); });
bot.action(/t_(.+)/, async (ctx) => { const s = getS(ctx.from.id); if (!s.adding) return; s.adding.data.temp = ctx.match[1]; s.adding.step = 'desc'; await ctx.answerCbQuery(); await ctx.reply('Шаг 7/7: Описание / особенности ухода:'); });

// ====== WEBHOOK ======
app.use(express.json());
app.use(bot.webhookCallback('/webhook'));
app.get('/', (_, r) => r.send('🌿 PlantBook 2.0'));
app.get('/health', (_, r) => r.json({ ok: true }));

const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.WEBHOOK_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null);

app.listen(PORT, async () => {
  console.log(`🌿 Порт ${PORT}`);
  if (DOMAIN) { const u = `${DOMAIN}/webhook`; await bot.telegram.setWebhook(u); console.log(`🔗 ${u}`); }
});

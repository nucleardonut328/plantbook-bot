export async function analyzePlant(plant) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return '❌ *Ошибка:* добавьте `GROQ_API_KEY` в переменные окружения Railway.';

  const prompt = `Ты эксперт по комнатным растениям. Проанализируй растение "${plant.name}" (${plant.latin_name}).
Характеристики: категория ${plant.category}, освещение ${plant.light}, полив ${plant.water}, температура ${plant.temp}.
Описание: ${plant.description}

Дай развёрнутый анализ (4-5 пунктов): общее состояние, рекомендации по поливу и свету, возможные проблемы, дополнительные советы. Используй эмодзи. Отвечай на русском.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3-8b-8192', messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 1500 })
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '⚠️ Пустой ответ от AI';
  } catch (err) {
    console.error('Groq error:', err);
    return `⚠️ *Ошибка AI:* ${err.message}\n\nПроверьте GROQ_API_KEY.`;
  }
}

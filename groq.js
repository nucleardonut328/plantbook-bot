export async function analyzePlant(plant) {
  const key = process.env.GROQ_API_KEY;

  if (!key) {
    return '❌ *Ошибка:* добавьте `GROQ_API_KEY` в Railway Variables.';
  }

  const prompt = `Ты эксперт по комнатным растениям. Проанализируй растение "${plant.name}" (${plant.latin_name}).
Характеристики: категория ${plant.category}, освещение ${plant.light}, полив ${plant.water}, температура ${plant.temp}.
Описание: ${plant.description}

Дай развёрнутый анализ (5-6 пунктов): общее состояние, рекомендации по поливу и свету, возможные проблемы, дополнительные советы. Используй эмодзи. Отвечай на русском.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',  // ← НОВАЯ МОДЕЛЬ
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HTTP ${res.status}: ${err.substring(0, 100)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '⚠️ Пустой ответ от AI';

  } catch (err) {
    console.error('Groq error:', err.message);
    return `⚠️ *Ошибка AI:* ${err.message}`;
  }
}

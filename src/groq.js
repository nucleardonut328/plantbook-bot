export async function analyzePlant(plant) {
  // Отладка: проверяем переменные окружения
  console.log('=== GROQ DEBUG ===');
  console.log('GROQ_API_KEY exists:', !!process.env.GROQ_API_KEY);
  console.log('GROQ_API_KEY length:', process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.length : 0);
  console.log('GROQ_API_KEY starts with gsk_:', process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.startsWith('gsk_') : false);
  console.log('All env keys:', Object.keys(process.env).filter(k => k.includes('GROQ') || k.includes('API') || k.includes('KEY')));
  console.log('==================');

  const key = process.env.GROQ_API_KEY;

  if (!key) {
    return '❌ *Ошибка:* переменная `GROQ_API_KEY` не найдена. Добавьте её в Railway Variables (⚙️ → Variables → New Variable).';
  }

  if (!key.startsWith('gsk_')) {
    return '❌ *Ошибка:* ключ должен начинаться с `gsk_`. Получите ключ на console.groq.com';
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
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    console.log('GROQ response status:', res.status);

    if (!res.ok) {
      const errText = await res.text();
      console.log('GROQ error body:', errText);
      throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
    }

    const data = await res.json();
    console.log('GROQ response choices:', data.choices ? 'exists' : 'missing');
    
    return data.choices?.[0]?.message?.content || '⚠️ Пустой ответ от AI';

  } catch (err) {
    console.error('GROQ ERROR:', err.message);
    return `⚠️ *Ошибка AI:* ${err.message}\n\nПроверьте GROQ_API_KEY в Railway Variables.`;
  }
}

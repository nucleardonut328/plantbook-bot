import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function analyzePlant(plant) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama3-8b-8192',
      messages: [{
        role: 'user',
        content: `Ты эксперт по комнатным растениям. Дай советы по уходу за "${plant.name}" (${plant.latin_name}).
        
Свет: ${plant.light}, Полив: ${plant.water}, Температура: ${plant.temp}

Ответь коротко по пунктам с эмодзи на русском языке:
1. 💧 Полив:
2. ☀️ Свет:
3. 🌡️ Температура:
4. ⚠️ Частые ошибки:`
      }],
      max_tokens: 500
    });
    return completion.choices[0].message.content;
  } catch (e) {
    return '❌ Ошибка анализа. Попробуйте позже.';
  }
}

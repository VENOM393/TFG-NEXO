'use strict';

const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Eres NexoBot, el asesor experto en criptomonedas de NexoBank. Eres un analista financiero especializado en activos digitales con amplia experiencia en los mercados crypto. Tu misión es ayudar al cliente a tomar mejores decisiones de inversión.

Personalidad:
- Profesional pero cercano y directo
- Usa emojis con moderación para dinamizar la conversación
- Responde siempre en español
- Eres honesto sobre la incertidumbre del mercado

Cuando analices portfolios o respondan preguntas:
- Sé específico con los datos del cliente (precios, P&L, cantidades)
- Evalúa diversificación, concentración de riesgo y rendimiento
- Sugiere estrategias concretas cuando sea relevante
- Comenta tendencias del mercado si aportan valor
- Usa guiones (-) para listas, nunca asteriscos de lista

Formato de respuesta:
- Máximo 5-6 párrafos, conciso y directo
- Usa saltos de línea para separar ideas
- Las palabras clave en **negrita**
- Termina siempre con una línea de disclaimer comenzando con ⚠️`;

async function chat(req, res) {
    const { messages, portfolioContext } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Mensajes inválidos' });
    }

    const systemContent = portfolioContext
        ? `${SYSTEM_PROMPT}\n\n--- PORTFOLIO ACTUAL DEL CLIENTE (datos en tiempo real) ---\n${portfolioContext}`
        : SYSTEM_PROMPT;

    try {
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemContent },
                ...messages.slice(-20),
            ],
            temperature: 0.65,
            max_tokens: 1024,
        });

        const reply = completion.choices[0]?.message?.content
            || 'No he podido generar una respuesta. Inténtalo de nuevo.';

        res.json({ reply });
    } catch (err) {
        console.error('[NexoBot] Error Groq API:', err.message);
        res.status(500).json({
            error: 'Error al conectar con el servicio de IA. Inténtalo en unos segundos.',
        });
    }
}

module.exports = { chat };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY nao configurada' });

  const { list } = req.body || {};
  if (!list) return res.status(400).json({ error: 'Campo list em falta' });

  const prompt = `Analisa esta lista de compras para uma familia portuguesa de 4 pessoas (2 adultos + 2 criancas de 4 e 6 anos) e distribui os produtos pelos supermercados mais baratos em Portugal: LIDL, Pingo Doce, ALDI e Continente.

Estrategia tipica: LIDL/ALDI para conservas, basicos, carnes, laticinios, snacks, limpeza, higiene e congelados. Pingo Doce para frescos (legumes, frutas) e padaria. Continente como alternativa pontual.

Actualmente gastam 227 euros por semana no Mercadona.

Usa o teu conhecimento de precos de supermercados portugueses de 2025 para estimar precos reais de marcas proprias/brancas.

Responde APENAS com JSON valido (sem markdown, sem texto antes ou depois):
{
  "semana": "Abr 2026",
  "promos": [
    "LIDL: Arroz agulha -20% esta semana",
    "Pingo Doce: 30% saldo em carnes de porco e ovos",
    "ALDI: Peito frango a 3.99/kg"
  ],
  "stores": [
    {
      "id": "lidl",
      "name": "LIDL",
      "color": "#f5c200",
      "tagline": "cabaz principal",
      "categories": [
        {
          "name": "Conservas",
          "items": [
            {"name": "Atum ao natural 120g", "qty": 3, "unit": "latas", "price": 0.79, "promo": ""},
            {"name": "Feijao encarnado 400g", "qty": 2, "unit": "latas", "price": 0.45, "promo": ""}
          ]
        }
      ],
      "total": 72.50
    },
    {
      "id": "pingodoce",
      "name": "Pingo Doce",
      "color": "#00873d",
      "tagline": "frescos e padaria",
      "categories": [],
      "total": 55.00
    },
    {
      "id": "aldi",
      "name": "ALDI",
      "color": "#003087",
      "tagline": "alternativas e promocoes",
      "categories": [],
      "total": 30.00
    }
  ],
  "total_mix": 157.50,
  "saving_weekly": 69.50,
  "saving_annual": 3614.00
}

LISTA DE COMPRAS:
${list}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Erro na API' });
    }

    const data = await response.json();
    const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

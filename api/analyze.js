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

  const prompt = `Analisa esta lista de compras para uma familia portuguesa de 4 pessoas (2 adultos + 2 criancas de 4 e 6 anos) em Lisboa/Matosinhos e distribui os produtos pelos supermercados mais baratos: LIDL, Pingo Doce e ALDI.

ESTRATEGIA DE COMPRAS DESTA FAMILIA:
- LIDL: conservas, basicos (arroz, massa), carnes, laticinios, snacks, limpeza, higiene, congelados, peixe congelado
- Pingo Doce: frescos (legumes, frutas ao kg), padaria, peixe fresco, carnes frescas premium
- ALDI: alternativa ao LIDL quando ha promocoes melhores
- Actualmente gastam 227€/semana no Mercadona — objetivo e poupar ~70€/semana

PRECOS REAIS DESTA FAMILIA (obtidos dos recibos de maio 2026 — usa estes como base):

LIDL:
- Atum ao natural 120g: 0,79€/lata
- Arroz agulha emb familiar: 2,15€
- Queijo flamengo fatiado: 3,99€/emb
- MSC Lombos de Pescada (congelada): 9,69€/emb
- Gelado Double Bilionario: 3,49€
- Gelado Space Runners: 2,69€
- Mistura legumes chinesa (congelada): 0,99€/emb
- Mistura legumes mexicana (congelada): 2,99€/emb
- Espinafres frescos: 1,15€/emb
- Mirtilos 500g: 6,59€ (promo Lidl Plus por vezes gratuito)
- Iogurte grego natural: 1,75€/emb
- Iogurte com proteina Pack8: 3,29€
- Natas para culinaria 200ml: 0,79€/uni
- Mel floral: 5,29€
- Rolo de cozinha 2 folhas: 0,79€
- Salmao posta fresco: 17,99€/kg

PINGO DOCE:
- Robalo fresco 200/600g: 9,99€/kg
- Hamburguer Novilho Angus 400g: 6,98€/emb
- Bife Novilho Angus: 30,48€/kg
- Peito frango: ~7,99€/kg
- Pernas de frango churra: 8,49€/kg
- Morango emb 500g: 2,99€ (promo imediata -1,00€ frequente = 1,99€ efetivo)
- Kiwi Sungold Zespri: 3,99€/emb
- Cenoura granel: 1,09€/kg
- Maca Gala: 1,99€/kg
- Broculos: 2,99€/kg
- Uva Honey Bran 700g: 4,49€
- Uva Red Globe: 3,99€/kg
- Curgete: 1,99€/kg
- Abobora manteiga: 1,79€/kg
- Petit Filous 6x100g: 1,19€
- Natas UHT PD 200ml: 0,83€
- Bolachas Digestive 400g: 0,99€
- Bolachas Aveia 300g: 1,09€
- Ovos M/L matinado 12u: 4,59€
- Queijo Babybel 12x20g: 4,79€
- Queijo Vaca que ri 16T: 3,49€

MERCADONA (para produtos especificos):
- L'Casei Morango (iogurte liquido): 2,55€
- Muesli frutos secos: 2,10€
- Barritas aveia cacao: 1,65€
- Snack queijo de vaca: 3,15€
- Barra Muesli Choc: 1,55€
- Ovos 12 ar livre: 3,55€

INSTRUCOES:
1. Para produtos com preco real acima, usa esse preco (ou muito proximo)
2. Para produtos sem preco de referencia, estima com base em marcas proprias portuguesas de 2025
3. Aplica promocoes reais conhecidas (ex: Pingo Doce "Poupa Mais", Lidl Plus)
4. O campo "promo" so deve ser preenchido se ha uma promocao concreta conhecida (ex: "-20% esta semana", "Pack 2x1", "Promo Lidl Plus")
5. Nao inventes promocoes — deixa "promo": "" se nao tiveres a certeza
6. Distribui cada produto pela loja mais barata de acordo com a estrategia desta familia

Responde APENAS com JSON valido (sem markdown, sem texto antes ou depois):
{
  "semana": "Mai 2026",
  "promos": [
    "LIDL: Mirtilos 500g gratis com Lidl Plus",
    "Pingo Doce: Morango 500g 1,99€ (promo imediata -1€)"
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
            {"name": "Atum ao natural 120g", "qty": 3, "unit": "latas", "price": 0.79, "promo": ""}
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

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
 
  const prompt = `Analisa esta lista de compras para uma familia portuguesa de 4 pessoas (2 adultos + 2 criancas de 4 e 6 anos) em Lisboa/Matosinhos.
 
TAREFA:
1. Pesquisa os precos ATUAIS de cada produto nas lojas portuguesas (LIDL, Pingo Doce, ALDI)
2. Verifica se ha promocoes, cupoes ou descontos ativos esta semana em cada loja
3. Distribui cada produto pela loja com melhor preco/promocao neste momento
4. Calcula a poupanca vs Mercadona (referencia: 227 euros/semana)
 
NOMES DOS PRODUTOS NOS RECIBOS DESTA FAMILIA (usa estes nomes exatos para pesquisar precos atuais):
- Atum ao natural 120g → pesquisa "atum natural LIDL" / "atum natural Pingo Doce"
- Arroz agulha → pesquisa "arroz agulha LIDL embalagem familiar"
- Queijo flamengo fatiado → pesquisa "queijo flamengo fatiado LIDL"
- Pescada congelada → pesquisa "MSC lombos pescada LIDL"
- Gelados → pesquisa "gelado Double Bilionario LIDL" / "gelado Space Runners LIDL"
- Legumes congelados → pesquisa "mistura legumes chinesa LIDL" / "mistura mexicana LIDL"
- Espinafres → pesquisa "espinafres LIDL"
- Mirtilos → pesquisa "mirtilos 500g LIDL"
- Iogurte grego → pesquisa "iogurte grego natural LIDL"
- Iogurte com proteina → pesquisa "iogurte proteina pack LIDL"
- Natas culinaria → pesquisa "natas culinaria 200ml LIDL"
- Salmao fresco → pesquisa "salmao posta LIDL fresco preco"
- Bife vaca → pesquisa "bife novilho angus Pingo Doce preco"
- Hamburguer vaca → pesquisa "hamburguer novilho angus 400g Pingo Doce"
- Frango → pesquisa "pernas frango Pingo Doce" / "peito frango Pingo Doce preco"
- Peixe fresco → pesquisa "robalo fresco Pingo Doce preco kg"
- Morangos → pesquisa "morango 500g Pingo Doce preco"
- Kiwi → pesquisa "kiwi sungold zespri Pingo Doce"
- Cenoura → pesquisa "cenoura granel Pingo Doce kg preco"
- Maca → pesquisa "maca gala Pingo Doce kg preco"
- Broculos → pesquisa "broculos Pingo Doce kg preco"
- Courgette → pesquisa "curgete Pingo Doce kg preco"
- Abobora → pesquisa "abobora manteiga Pingo Doce preco"
- Uvas → pesquisa "uva honey bran Pingo Doce"
- Ovos → pesquisa "ovos 12 Pingo Doce preco" / "ovos 12 LIDL preco"
- Bolachas digestive → pesquisa "bolachas digestive Pingo Doce 400g preco"
- Mel → pesquisa "mel floral LIDL preco"
- Papel cozinha → pesquisa "rolo cozinha LIDL preco"
 
ESTRATEGIA DE DISTRIBUICAO:
- LIDL: conservas, basicos, carnes, laticinios, snacks, limpeza, higiene, congelados, peixe congelado
- Pingo Doce: frescos (legumes ao peso, frutas), padaria, peixe fresco, carnes premium
- ALDI: alternativa quando tem melhor preco que LIDL esta semana
 
INSTRUCOES:
- Usa os precos ATUAIS encontrados na pesquisa, nunca estimativas desatualizadas
- Se encontrares promocao ou cupao ativo esta semana, indica no campo "promo" (ex: "Lidl Plus gratis", "-30% esta semana", "2 por 1", "Poupa Mais -20%")
- Deixa "promo": "" se nao ha promocao confirmada neste momento
- Se nao encontrares preco atual para um produto especifico, estima com base em precos de marcas proprias portuguesas atuais
 
Responde APENAS com JSON valido (sem markdown, sem texto antes ou depois):
{
  "semana": "Mai 2026",
  "promos": ["LIDL: Mirtilos 500g gratis com Lidl Plus", "Pingo Doce: Morango 500g poupanca imediata -1euro"],
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
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 5000,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search'
          }
        ],
        messages: [{ role: 'user', content: prompt }]
      })
    });
 
    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Erro na API' });
    }
 
    const data = await response.json();
 
    // Extrair apenas blocos de texto (web_search devolve blocos mistos)
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');
 
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);
 
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

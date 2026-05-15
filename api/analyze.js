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
 
  const today = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
 
  const prompt = `Hoje e ${today}. Pesquisa os precos ATUAIS desta lista de compras nos supermercados portugueses LIDL, Pingo Doce e ALDI.
 
IMPORTANTE: Os precos DEVEM ser os de hoje — pesquisa ativamente os sites, folhetos e apps de cada supermercado. Verifica promocoes, cupoes Lidl Plus, descontos Poupa Mais, e ofertas especiais desta semana. Nao uses precos memorizados ou estimativas — so precos encontrados na pesquisa.
 
FAMILIA: 4 pessoas em Matosinhos/Lisboa.
Estrategia de distribuicao:
- LIDL: conservas, basicos, laticinios, snacks, congelados, limpeza, higiene
- Pingo Doce: frescos (legumes, frutas), padaria, peixe fresco, carnes premium
- ALDI: alternativa quando tem preco melhor que LIDL esta semana
 
NOMES EXATOS DOS PRODUTOS para pesquisar (usa estes termos nas pesquisas):
LIDL → "atum natural LIDL", "arroz agulha LIDL familiar", "queijo flamengo fatiado LIDL", "lombos pescada MSC LIDL", "gelado Double Bilionario LIDL", "gelado Space Runners LIDL", "mistura legumes chinesa LIDL", "mistura legumes mexicana LIDL", "espinafres LIDL", "mirtilos 500g LIDL", "iogurte grego natural LIDL", "iogurte proteina pack LIDL", "natas culinaria 200ml LIDL", "salmao posta LIDL", "mel floral LIDL", "rolo cozinha LIDL"
Pingo Doce → "bife novilho angus Pingo Doce", "hamburguer angus 400g Pingo Doce", "pernas frango Pingo Doce", "peito frango Pingo Doce", "robalo fresco Pingo Doce", "morango 500g Pingo Doce", "kiwi sungold zespri Pingo Doce", "cenoura granel Pingo Doce", "maca gala Pingo Doce", "broculos Pingo Doce", "curgete Pingo Doce", "abobora manteiga Pingo Doce", "bolachas digestive Pingo Doce", "ovos 12 Pingo Doce"
 
Para cada produto encontrado: usa o preco atual da pesquisa. Se encontrares promocao ativa (Lidl Plus, Poupa Mais, desconto semana, etc), indica-a no campo "promo".
 
LISTA DE COMPRAS:
${list}
 
Responde APENAS com o objeto JSON (sem texto antes nem depois):
{"semana":"Mai 2026","promos":["LIDL: exemplo promo ativa"],"stores":[{"id":"lidl","name":"LIDL","color":"#f5c200","tagline":"cabaz principal","categories":[{"name":"Conservas","items":[{"name":"Atum ao natural 120g","qty":3,"unit":"latas","price":0.79,"promo":""}]}],"total":72.50},{"id":"pingodoce","name":"Pingo Doce","color":"#00873d","tagline":"frescos e padaria","categories":[],"total":55.00},{"id":"aldi","name":"ALDI","color":"#003087","tagline":"alternativas","categories":[],"total":20.00}],"total_mix":147.50,"saving_weekly":0,"saving_annual":0}`;
 
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
        system: 'You are a JSON API. You MUST respond with ONLY a valid JSON object. No explanations, no markdown, no text before or after the JSON. Just the raw JSON object starting with { and ending with }.',
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });
 
    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Erro na API' });
    }
 
    const data = await response.json();
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');
 
    const clean = text.replace(/```json|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch(e) {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('JSON invalido: ' + clean.slice(0, 150));
    }
 
    if (!parsed.saving_weekly) parsed.saving_weekly = 0;
    if (!parsed.saving_annual) parsed.saving_annual = 0;
 
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

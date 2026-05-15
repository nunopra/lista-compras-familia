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

  try {
    // ── FASE 1: pesquisa web de preços atuais ──
    const searchPrompt = `Hoje e ${today}. Pesquisa os precos ATUAIS nos supermercados portugueses LIDL, Pingo Doce e ALDI para esta lista de compras de uma familia em Matosinhos.

Usa os nomes exatos para pesquisar:
LIDL: atum natural 120g, arroz agulha emb familiar, queijo flamengo fatiado, lombos pescada MSC, gelado Double Bilionario, gelado Space Runners, mistura legumes chinesa, mistura legumes mexicana, espinafres, mirtilos 500g, iogurte grego natural, iogurte proteina pack8, natas culinaria 200ml, salmao posta fresco, mel floral, rolo cozinha 2 folhas
Pingo Doce: bife novilho angus, hamburguer angus 400g, pernas frango, peito frango, robalo fresco, morango 500g, kiwi sungold zespri, cenoura granel kg, maca gala kg, broculos kg, curgete kg, abobora manteiga, bolachas digestive 400g, ovos 12 unidades

Para cada produto encontra: preco atual, e se ha promocao ativa (Lidl Plus, Poupa Mais, desconto semana).

LISTA DE COMPRAS:
${list}`;

    const r1 = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: searchPrompt }]
      })
    });

    if (!r1.ok) {
      const err = await r1.json();
      throw new Error(err.error?.message || 'Erro fase 1: ' + r1.status);
    }

    const d1 = await r1.json();
    const priceResearch = (d1.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    // ── FASE 2: formatar como JSON puro ──
    const formatPrompt = `Com base nesta pesquisa de precos de hoje (${today}), cria o JSON da lista de compras distribuida por supermercado.

PESQUISA DE PRECOS:
${priceResearch}

Regras de distribuicao:
- LIDL: conservas, basicos, laticinios, snacks, congelados, limpeza, higiene
- Pingo Doce: frescos (legumes ao peso, frutas), padaria, peixe fresco, carnes premium
- ALDI: alternativa quando tem preco melhor que LIDL

Responde APENAS com JSON valido, sem texto antes ou depois, sem markdown:
{"semana":"Mai 2026","promos":["LIDL: exemplo promo ativa esta semana"],"stores":[{"id":"lidl","name":"LIDL","color":"#f5c200","tagline":"cabaz principal","categories":[{"name":"Conservas","items":[{"name":"Atum ao natural 120g","qty":3,"unit":"latas","price":0.79,"promo":""}]}],"total":72.50},{"id":"pingodoce","name":"Pingo Doce","color":"#00873d","tagline":"frescos e padaria","categories":[],"total":55.00},{"id":"aldi","name":"ALDI","color":"#003087","tagline":"alternativas","categories":[],"total":20.00}],"total_mix":147.50}`;

    const r2 = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [
          { role: 'user', content: formatPrompt },
          { role: 'assistant', content: '{' }
        ]
      })
    });

    if (!r2.ok) {
      const err = await r2.json();
      throw new Error(err.error?.message || 'Erro fase 2: ' + r2.status);
    }

    const d2 = await r2.json();
    const rawText = (d2.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // A resposta começa onde parou o prefill ('{')
    const jsonText = '{' + rawText;
    const parsed = JSON.parse(jsonText);

    // Garantir que campos de poupanca existem (mesmo que 0)
    parsed.saving_weekly = 0;
    parsed.saving_annual = 0;

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

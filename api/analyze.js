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
        max_tokens: 3000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Hoje e ${today}. Pesquisa os precos ATUAIS nos supermercados LIDL, Pingo Doce e ALDI em Portugal para estes produtos. Verifica promocoes, cupoes Lidl Plus e descontos Poupa Mais ativos esta semana.

Produtos a pesquisar (nomes exatos como aparecem nos recibos):
LIDL: "atum ao natural 120g", "arroz agulha embalagem familiar", "queijo flamengo fatiado", "lombos pescada MSC", "gelado Double Bilionario", "gelado Space Runners", "mistura legumes chinesa", "mistura legumes mexicana", "espinafres", "mirtilos 500g", "iogurte grego natural", "iogurte proteina pack8", "natas culinaria 200ml", "salmao posta fresco"
Pingo Doce: "bife novilho angus", "hamburguer angus 400g", "pernas frango", "peito frango", "robalo fresco", "morango 500g", "kiwi sungold zespri", "cenoura granel", "maca gala", "broculos", "curgete kg", "abobora manteiga", "bolachas digestive 400g", "ovos 12"

LISTA DE COMPRAS:
${list}

Lista os precos atuais encontrados e qualquer promocao ativa.`
        }]
      })
    });

    if (!r1.ok) throw new Error('Pesquisa falhou: ' + r1.status);
    const d1 = await r1.json();
    const priceData = (d1.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');

    // ── FASE 2: formatar JSON com prefill garantido ──
    const r2 = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [
          {
            role: 'user',
            content: `Com base nestes precos pesquisados hoje (${today}), distribui a lista pelos supermercados e devolve APENAS JSON.

PRECOS PESQUISADOS:
${priceData}

REGRAS:
- LIDL: conservas, basicos, laticinios, snacks, congelados, limpeza, higiene
- Pingo Doce: frescos (legumes ao peso, frutas), padaria, peixe fresco, carnes premium
- ALDI: alternativa quando tem melhor preco que LIDL

FORMATO EXACTO (devolve apenas este JSON, sem texto):
{"semana":"Mai 2026","promos":["LIDL: promo ativa"],"stores":[{"id":"lidl","name":"LIDL","color":"#f5c200","tagline":"cabaz principal","categories":[{"name":"Conservas","items":[{"name":"Atum ao natural 120g","qty":3,"unit":"latas","price":0.79,"promo":""}]}],"total":72.50},{"id":"pingodoce","name":"Pingo Doce","color":"#00873d","tagline":"frescos e padaria","categories":[],"total":55.00},{"id":"aldi","name":"ALDI","color":"#003087","tagline":"alternativas","categories":[],"total":20.00}],"total_mix":147.50}`
          },
          {
            role: 'assistant',
            content: '{"semana":"'
          }
        ]
      })
    });

    if (!r2.ok) throw new Error('Formatacao falhou: ' + r2.status);
    const d2 = await r2.json();
    const text = (d2.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const parsed = JSON.parse('{"semana":"' + text);
    parsed.saving_weekly = 0;
    parsed.saving_annual = 0;

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

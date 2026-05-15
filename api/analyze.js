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
 
  const month = new Date().toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
 
  try {
    // ── FASE 1: pesquisa web de preços reais (~15-25s) ──
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
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        messages: [{
          role: 'user',
          content: `Pesquisa os precos ATUAIS em Portugal (${month}) nos supermercados LIDL, Pingo Doce e ALDI para estes produtos. Verifica promocoes ativas (Lidl Plus, Poupa Mais, etc). Responde com uma lista simples de produto: preco, loja, promocao se houver.
 
LISTA:
${list}`
        }]
      })
    });
 
    if (!r1.ok) throw new Error('Pesquisa falhou: ' + r1.status);
    const d1 = await r1.json();
    const priceInfo = (d1.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
 
    // ── FASE 2: formatar JSON com prefill garantido (~3-5s) ──
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
            content: `Com base nestes precos pesquisados hoje em Portugal, distribui a lista pelos supermercados.
 
PRECOS ENCONTRADOS:
${priceInfo}
 
Estrategia:
- LIDL: conservas, basicos, laticinios, snacks, congelados, limpeza, higiene
- Pingo Doce: frescos ao peso, padaria, peixe fresco, carnes premium
- ALDI: alternativa quando tem melhor preco
 
Formato do JSON de resposta:
{"semana":"${month}","promos":["promo ativa se houver"],"stores":[{"id":"lidl","name":"LIDL","color":"#f5c200","tagline":"cabaz principal","categories":[{"name":"Conservas","items":[{"name":"Atum ao natural 120g","qty":3,"unit":"latas","price":0.79,"promo":""}]}],"total":72.50},{"id":"pingodoce","name":"Pingo Doce","color":"#00873d","tagline":"frescos e padaria","categories":[],"total":55.00},{"id":"aldi","name":"ALDI","color":"#003087","tagline":"alternativas","categories":[],"total":20.00}],"total_mix":147.50}`
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
    const rawText = (d2.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
 
    // Combinar prefill + resposta e extrair JSON completo
    const full = '{"semana":"' + rawText;
    const lastBrace = full.lastIndexOf('}');
    if (lastBrace < 0) throw new Error('JSON incompleto na resposta');
    const parsed = JSON.parse(full.slice(0, lastBrace + 1));
 
    parsed.saving_weekly = 0;
    parsed.saving_annual = 0;
    return res.status(200).json(parsed);
 
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

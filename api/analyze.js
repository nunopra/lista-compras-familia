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
    // ── FASE 1: pesquisa web (~15-25s) ──
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
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
        messages: [{
          role: 'user',
          content: `Pesquisa precos atuais em Portugal (${month}) no LIDL, Pingo Doce e ALDI para estes produtos. Indica preco, loja e promocao se houver (Lidl Plus, Poupa Mais):\n\n${list}`
        }]
      })
    });
 
    if (!r1.ok) {
      const e = await r1.json().catch(() => ({}));
      throw new Error('Pesquisa: ' + (e.error?.message || r1.status));
    }
    const d1 = await r1.json();
    // Limitar a 2000 chars para nao exceder tokens na fase 2
    const priceInfo = (d1.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').slice(0, 2000);
 
    // ── FASE 2: formatar JSON com prefill { (~3-5s) ──
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
            content: `Distribui esta lista de compras pelos supermercados com os precos encontrados. LIDL para basicos/laticinios/congelados, Pingo Doce para frescos/padaria/carnes, ALDI como alternativa.
 
Precos pesquisados:
${priceInfo}
 
Lista original:
${list}
 
Responde com JSON seguindo este formato exato:
{"semana":"${month}","promos":[],"stores":[{"id":"lidl","name":"LIDL","color":"#f5c200","tagline":"cabaz principal","categories":[{"name":"Conservas","items":[{"name":"produto","qty":1,"unit":"un","price":0.99,"promo":""}]}],"total":0},{"id":"pingodoce","name":"Pingo Doce","color":"#00873d","tagline":"frescos e padaria","categories":[],"total":0},{"id":"aldi","name":"ALDI","color":"#003087","tagline":"alternativas","categories":[],"total":0}],"total_mix":0}`
          },
          { role: 'assistant', content: '{' }
        ]
      })
    });
 
    if (!r2.ok) {
      const e = await r2.json().catch(() => ({}));
      throw new Error('Formatacao: ' + (e.error?.message || r2.status));
    }
    const d2 = await r2.json();
    const txt = (d2.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
 
    // Combinar prefill '{' + resposta, cortar no ultimo }
    const full = '{' + txt;
    const last = full.lastIndexOf('}');
    if (last < 0) throw new Error('JSON incompleto');
    const parsed = JSON.parse(full.slice(0, last + 1));
    parsed.saving_weekly = 0;
    parsed.saving_annual = 0;
    return res.status(200).json(parsed);
 
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

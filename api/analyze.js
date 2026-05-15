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
 
  const prompt = `Pesquisa os precos atuais em Portugal (${month}) nos supermercados LIDL, Pingo Doce e ALDI para esta lista de compras. Verifica promocoes ativas (Lidl Plus, Poupa Mais, etc).
 
Estrategia de distribuicao:
- LIDL: conservas, basicos, laticinios, snacks, congelados, limpeza, higiene
- Pingo Doce: frescos ao peso, padaria, peixe fresco, carnes premium
- ALDI: alternativa quando tem melhor preco
 
LISTA:
${list}
 
Responde APENAS com o objeto JSON abaixo preenchido, sem texto antes ou depois:
{"semana":"${month}","promos":["promocao ativa se houver"],"stores":[{"id":"lidl","name":"LIDL","color":"#f5c200","tagline":"cabaz principal","categories":[{"name":"Conservas","items":[{"name":"Atum ao natural 120g","qty":3,"unit":"latas","price":0.79,"promo":""}]}],"total":72.50},{"id":"pingodoce","name":"Pingo Doce","color":"#00873d","tagline":"frescos e padaria","categories":[],"total":55.00},{"id":"aldi","name":"ALDI","color":"#003087","tagline":"alternativas","categories":[],"total":20.00}],"total_mix":147.50}`;
 
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
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        messages: [{ role: 'user', content: prompt }]
      })
    });
 
    if (!response.ok) {
      const e = await response.json().catch(() => ({}));
      throw new Error(e.error?.message || 'Erro ' + response.status);
    }
 
    const data = await response.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
 
    // Extrair JSON: primeiro { ate ao ultimo }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Sem JSON na resposta');
 
    const parsed = JSON.parse(text.slice(start, end + 1));
    parsed.saving_weekly = 0;
    parsed.saving_annual = 0;
    return res.status(200).json(parsed);
 
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

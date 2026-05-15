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
 
  // Extrai o primeiro objeto JSON completo de um texto com conteudo misto
  function extractJSON(text) {
    // Remove markdown
    const clean = text.replace(/```json/gi, '').replace(/```/g, '');
    // Encontrar {"semana": especificamente
    const semanaIdx = clean.indexOf('"semana"');
    if (semanaIdx < 0) return null;
    const openBrace = clean.lastIndexOf('{', semanaIdx);
    if (openBrace < 0) return null;
    // Contar chavetas para encontrar o fecho correto
    let depth = 0, inString = false, escape = false;
    for (let i = openBrace; i < clean.length; i++) {
      const c = clean[i];
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === '{') depth++;
      if (c === '}') { depth--; if (depth === 0) return clean.slice(openBrace, i + 1); }
    }
    return null;
  }
 
  const prompt = `Pesquisa os precos atuais em Portugal (${month}) nos supermercados LIDL, Pingo Doce e ALDI para esta lista de compras. Verifica promocoes ativas (Lidl Plus, Poupa Mais, etc).
 
Estrategia:
- LIDL: conservas, basicos, laticinios, snacks, congelados, limpeza, higiene
- Pingo Doce: frescos ao peso, padaria, peixe fresco, carnes premium
- ALDI: alternativa quando tem melhor preco
 
LISTA:
${list}
 
No final da tua resposta inclui o JSON com a distribuicao e precos encontrados:
{"semana":"${month}","promos":["promo ativa"],"stores":[{"id":"lidl","name":"LIDL","color":"#f5c200","tagline":"cabaz principal","categories":[{"name":"Conservas","items":[{"name":"Atum ao natural 120g","qty":3,"unit":"latas","price":0.79,"promo":""}]}],"total":72.50},{"id":"pingodoce","name":"Pingo Doce","color":"#00873d","tagline":"frescos e padaria","categories":[],"total":55.00},{"id":"aldi","name":"ALDI","color":"#003087","tagline":"alternativas","categories":[],"total":20.00}],"total_mix":147.50}`;
 
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
    const jsonStr = extractJSON(text);
    if (!jsonStr) throw new Error('Sem JSON valido na resposta');
 
    const parsed = JSON.parse(jsonStr);
    parsed.saving_weekly = 0;
    parsed.saving_annual = 0;
    return res.status(200).json(parsed);
 
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

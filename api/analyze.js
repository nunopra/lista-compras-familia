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
 
  const prompt = `Pesquisa os precos atuais em Portugal (${month}) para esta lista de compras e distribui pelos supermercados mais baratos: LIDL, Pingo Doce e ALDI.
 
Familia de 4 pessoas em Matosinhos. Estrategia:
- LIDL: conservas, basicos, laticinios, snacks, congelados, limpeza, higiene
- Pingo Doce: frescos ao peso, padaria, peixe fresco, carnes premium
- ALDI: alternativa quando tem melhor preco que LIDL
 
Pesquisa precos atuais e promocoes desta semana (Lidl Plus, Poupa Mais, etc).
 
LISTA:
${list}
 
Coloca o resultado final dentro de tags <json> assim:
<json>
{"semana":"${month}","promos":["promo real se encontrada"],"stores":[{"id":"lidl","name":"LIDL","color":"#f5c200","tagline":"cabaz principal","categories":[{"name":"Conservas","items":[{"name":"Atum ao natural 120g","qty":3,"unit":"latas","price":0.79,"promo":""}]}],"total":72.50},{"id":"pingodoce","name":"Pingo Doce","color":"#00873d","tagline":"frescos e padaria","categories":[],"total":55.00},{"id":"aldi","name":"ALDI","color":"#003087","tagline":"alternativas","categories":[],"total":20.00}],"total_mix":147.50}
</json>`;
 
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
      const errText = await response.text();
      let errMsg;
      try { errMsg = JSON.parse(errText)?.error?.message; } catch(e) { errMsg = errText.slice(0, 200); }
      return res.status(response.status).json({ error: errMsg || 'Erro ' + response.status });
    }
 
    const data = await response.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
 
    // Extrair JSON das tags <json>...</json>
    const tagMatch = text.match(/<json>\s*([\s\S]*?)\s*<\/json>/);
    if (tagMatch) {
      const parsed = JSON.parse(tagMatch[1]);
      parsed.saving_weekly = 0;
      parsed.saving_annual = 0;
      return res.status(200).json(parsed);
    }
 
    // Fallback: tentar extrair JSON diretamente
    const clean = text.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      parsed.saving_weekly = 0;
      parsed.saving_annual = 0;
      return res.status(200).json(parsed);
    }
 
    throw new Error('Nao foi possivel extrair JSON da resposta');
 
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

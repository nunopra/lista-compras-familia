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
 
  const prompt = `Distribui esta lista de compras pelos supermercados mais baratos em Portugal (${month}) para uma familia de 4 pessoas em Matosinhos: LIDL, Pingo Doce e ALDI.
 
Estrategia:
- LIDL: conservas, basicos, laticinios, snacks, congelados, limpeza, higiene
- Pingo Doce: frescos ao peso, padaria, peixe fresco, carnes premium
- ALDI: alternativa quando tem melhor preco
 
Precos de referencia desta familia (recibos reais de 2026):
LIDL: atum natural 120g=0,79€, arroz agulha familiar=2,15€, queijo flamengo fatiado=3,99€, lombos pescada MSC=9,69€, gelado Double Bilionario=3,49€, gelado Space Runners=2,69€, mistura legumes chinesa=0,99€, mistura mexicana=2,99€, espinafres=1,15€, mirtilos 500g=6,59€, iogurte grego natural=1,75€, iogurte proteina pack8=3,29€, natas culinaria 200ml=0,79€, salmao posta=17,99€/kg, mel floral=5,29€
Pingo Doce: bife novilho angus=30,48€/kg, hamburguer angus 400g=6,98€, pernas frango=8,49€/kg, peito frango=7,99€/kg, robalo fresco=9,99€/kg, morango 500g=2,99€, kiwi sungold zespri=3,99€, cenoura granel=1,09€/kg, maca gala=1,99€/kg, broculos=2,99€/kg, curgete=1,99€/kg, abobora manteiga=1,79€/kg, bolachas digestive=0,99€, ovos 12=4,59€
 
Para produtos sem referencia usa o teu conhecimento de precos atuais de marcas proprias portuguesas. Indica promocoes que conheças (Lidl Plus, Poupa Mais).
 
Responde APENAS com JSON valido (sem texto, sem markdown):
{"semana":"${month}","promos":[],"stores":[{"id":"lidl","name":"LIDL","color":"#f5c200","tagline":"cabaz principal","categories":[{"name":"Conservas","items":[{"name":"Atum ao natural 120g","qty":3,"unit":"latas","price":0.79,"promo":""}]}],"total":72.50},{"id":"pingodoce","name":"Pingo Doce","color":"#00873d","tagline":"frescos e padaria","categories":[],"total":55.00},{"id":"aldi","name":"ALDI","color":"#003087","tagline":"alternativas","categories":[],"total":20.00}],"total_mix":147.50}
 
LISTA:
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
      const e = await response.json().catch(() => ({}));
      throw new Error(e.error?.message || 'Erro ' + response.status);
    }
 
    const data = await response.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    parsed.saving_weekly = 0;
    parsed.saving_annual = 0;
    return res.status(200).json(parsed);
 
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

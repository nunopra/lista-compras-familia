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
 
  const prompt = `Analisa esta lista de compras para uma familia portuguesa de 4 pessoas em Matosinhos e distribui os produtos pelos supermercados mais baratos: LIDL, Pingo Doce e ALDI.
 
ESTRATEGIA DESTA FAMILIA:
- LIDL: conservas, basicos (arroz, massa), laticinios, snacks, limpeza, higiene, congelados
- Pingo Doce: frescos (legumes ao peso, frutas), padaria, peixe fresco, carnes frescas
- ALDI: alternativa ao LIDL quando tem melhor preco
 
NOMES REAIS DOS PRODUTOS DESTA FAMILIA (usa estes para atribuir precos corretos):
- Atum ao natural 120g → LIDL 0,79€/lata
- Arroz agulha emb familiar → LIDL ~2,15€
- Queijo flamengo fatiado → LIDL ~3,99€
- Pescada lombos MSC → LIDL ~9,69€
- Gelado Double Bilionario → LIDL ~3,49€
- Gelado Space Runners → LIDL ~2,69€
- Mistura legumes chinesa → LIDL ~0,99€
- Mistura legumes mexicana → LIDL ~2,99€
- Espinafres → LIDL ~1,15€
- Mirtilos 500g → LIDL ~6,59€
- Iogurte grego natural → LIDL ~1,75€
- Iogurte com proteina Pack8 → LIDL ~3,29€
- Natas para culinaria 200ml → LIDL ~0,79€/uni
- Salmao posta → LIDL ~17,99€/kg
- Bife Novilho Angus → PD ~30€/kg
- Hamburguer Novilho Angus 400g → PD ~6,98€
- Pernas de frango → PD ~8,49€/kg
- Peito de frango → PD ~7,99€/kg
- Robalo fresco → PD ~9,99€/kg
- Morangos 500g → PD ~2,99€ (frequentemente com promo -1€)
- Kiwi Sungold Zespri → PD ~3,99€/emb
- Cenoura → PD ~1,09€/kg
- Maca Gala → PD ~1,99€/kg
- Broculos → PD ~2,99€/kg
- Courgette → PD ~1,99€/kg
- Abobora manteiga → PD ~1,79€/kg
- Bolachas Digestive 400g → PD ~0,99€
- Bolachas Aveia 300g → PD ~1,09€
- Papel de cozinha 2 folhas → LIDL ~0,79€
 
INSTRUCOES:
- Usa os precos de referencia acima quando disponiveis
- Para outros produtos estima com base em marcas proprias portuguesas atuais
- O campo "promo" so preenches se souberes de uma promocao concreta (ex: "Lidl Plus gratis", "Poupa Mais -20%"); caso contrario deixa ""
- NAO incluas o campo saving_weekly nem saving_annual na resposta — nao e necessario
- Responde APENAS com JSON valido, sem markdown, sem texto antes ou depois
 
Formato da resposta:
{"semana":"Mai 2026","promos":["exemplo de promo real"],"stores":[{"id":"lidl","name":"LIDL","color":"#f5c200","tagline":"cabaz principal","categories":[{"name":"Conservas","items":[{"name":"Atum ao natural 120g","qty":3,"unit":"latas","price":0.79,"promo":""}]}],"total":72.50},{"id":"pingodoce","name":"Pingo Doce","color":"#00873d","tagline":"frescos e padaria","categories":[],"total":55.00},{"id":"aldi","name":"ALDI","color":"#003087","tagline":"alternativas","categories":[],"total":20.00}],"total_mix":147.50}
 
LISTA DE COMPRAS:
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
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Erro na API' });
    }
 
    const data = await response.json();
    const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch(e) {
      // Try to extract JSON object if there's surrounding text
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('Resposta nao e JSON valido: ' + clean.slice(0, 100));
    }
    
    // Add dummy saving fields so app doesn't break
    if (!parsed.saving_weekly) parsed.saving_weekly = 0;
    if (!parsed.saving_annual) parsed.saving_annual = 0;
    
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

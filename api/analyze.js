export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { images, goal, style, imageCount } = req.body;
  const planCount = goal === '4' ? 3 : goal === '9' ? 6 : 4;
  const goalTxt = { '4': '四宫格生成3张', '9': '九宫格生成6张', 'inspire': '拍照灵感4个' }[goal] || '四宫格生成3张';

  const firstImage = (images || [])[0];
  if (!firstImage) return res.status(400).json({ error: '没有图片' });
  const base64Image = `data:${firstImage.mediaType || 'image/jpeg'};base64,${firstImage.data}`;

  const userPrompt = `Look at this travel photo and output ONLY a valid JSON object. No explanation, no markdown, just the JSON.

Fill every field with real specific content based on what you see. Output this structure with EXACTLY ${planCount} items in generationPlan:
{
  "location": {"country": "actual country", "city": "actual city", "spot": "specific place", "confidence": "90%"},
  "environment": {"season": "season", "timeOfDay": "morning/afternoon/evening", "weather": "clear/cloudy/etc", "atmosphere": "mood"},
  "subject": {"hasPersons": false, "personType": "", "style": [], "mood": ""},
  "expansionNodes": [
    {"emoji": "🏛️", "label": "建筑探索", "priority": "high"},
    {"emoji": "🌅", "label": "光影变化", "priority": "high"},
    {"emoji": "🍽️", "label": "当地美食", "priority": "medium"},
    {"emoji": "👥", "label": "人文故事", "priority": "medium"},
    {"emoji": "🛍️", "label": "市集文化", "priority": "low"},
    {"emoji": "🌿", "label": "自然细节", "priority": "low"}
  ],
  "generationPlan": [
    {
      "id": 1, "title": "具体中文方案名", "type": "scene",
      "composition": "具体构图方式", "logic": "为什么补这张", "shootingTips": "具体拍摄技巧",
      "imagePrompt": "Detailed English: describe exact scene in this photo - architecture, street, lighting, colors, people, atmosphere - travel photography, natural light, photorealistic",
      "socialTags": ["旅行", "风景"], "emoji": "🏛️"
    }
  ],
  "inspireTips": [
    {"title": "构图技巧", "type": "构图", "description": "具体建议", "bestTime": "最佳时间", "phoneTip": "手机技巧", "emoji": "📐"},
    {"title": "光线技巧", "type": "光线", "description": "具体建议", "bestTime": "最佳时间", "phoneTip": "手机技巧", "emoji": "🌅"},
    {"title": "人文技巧", "type": "人文", "description": "具体建议", "bestTime": "最佳时间", "phoneTip": "手机技巧", "emoji": "👥"}
  ],
  "summary": "一句中文描述这个地方的拍摄价值"
}

Goal: ${goalTxt}, Style: ${style}. generationPlan EXACTLY ${planCount} items, type from: scene/person/food/detail/vibe only.`;

  try {
    const resp = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-Vision-Free',
        max_tokens: 3000,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: base64Image } },
            { type: 'text', text: userPrompt },
          ],
        }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: err.error?.message || JSON.stringify(err) });
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
    if (s === -1 || e === -1) return res.status(500).json({ error: 'AI未返回有效JSON', raw: cleaned.slice(0, 300) });

    const parsed = JSON.parse(cleaned.slice(s, e + 1));
    return res.status(200).json({ success: true, data: parsed });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

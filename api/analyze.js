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

  const userPrompt = `Look at this travel photo carefully and output ONLY a valid JSON object. No explanation, no markdown, just JSON.

Fill every field with real specific content based on what you actually see in the image.

Output exactly this structure with ${planCount} items in generationPlan:
{
  "location": {"country": "actual country", "city": "actual city", "spot": "specific place name", "confidence": "90%"},
  "environment": {"season": "season you see", "timeOfDay": "morning/afternoon/evening/night", "weather": "clear/cloudy/etc", "atmosphere": "describe mood"},
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
      "id": 1,
      "title": "写具体中文方案名",
      "type": "scene",
      "composition": "写具体构图方式",
      "logic": "写为什么要补这张",
      "shootingTips": "写具体拍摄技巧",
      "imagePrompt": "Write detailed English prompt: describe the exact scene, architecture style, lighting, colors, atmosphere of this specific location. End with: travel photography, natural light, photorealistic",
      "socialTags": ["标签1", "标签2", "标签3"],
      "emoji": "🏛️"
    }
  ],
  "inspireTips": [
    {"title": "写构图技巧名", "type": "构图", "description": "写具体建议", "bestTime": "写最佳时间", "phoneTip": "写手机技巧", "emoji": "📐"},
    {"title": "写光线技巧名", "type": "光线", "description": "写具体建议", "bestTime": "写最佳时间", "phoneTip": "写手机技巧", "emoji": "🌅"},
    {"title": "写人文技巧名", "type": "人文", "description": "写具体建议", "bestTime": "写最佳时间", "phoneTip": "写手机技巧", "emoji": "👥"}
  ],
  "summary": "用一句中文描述这个地方的拍摄价值"
}

Goal: ${goalTxt}, Style: ${style}. generationPlan must have EXACTLY ${planCount} items with types from: scene/person/food/detail/vibe.`;

  try {
    const resp = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo',
        max_tokens: 3000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: base64Image } },
              { type: 'text', text: userPrompt },
            ],
          },
        ],
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

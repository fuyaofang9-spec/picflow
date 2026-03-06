export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { images, goal, style, imageCount } = req.body;

  const planCount = goal === '4' ? 3 : goal === '9' ? 6 : 4;
  const goalTxt = { '4': '四宫格生成3张', '9': '九宫格生成6张', 'inspire': '拍照灵感4个' }[goal] || '四宫格生成3张';

  // Build Gemini parts: images + text
  const parts = [];
  for (const img of (images || []).slice(0, 4)) {
    parts.push({ inline_data: { mime_type: img.mediaType || 'image/jpeg', data: img.data } });
  }
  parts.push({
    text: `分析这些旅行照片，只输出JSON不要任何其他文字。目标:${goalTxt}，风格:${style}，共${imageCount}张图。

每个generationPlan的imagePrompt必须是详细英文，描述具体场景/光线/构图，结尾加"travel photography, natural light, photorealistic"。

输出格式（所有中文字段15字以内）:
{"location":{"country":"国家","city":"城市","spot":"地点","confidence":"85%"},"environment":{"season":"季节","timeOfDay":"时段","weather":"天气","atmosphere":"氛围"},"subject":{"hasPersons":false,"personType":"","style":[],"mood":""},"expansionNodes":[{"emoji":"🍁","label":"延展方向","priority":"high"}],"generationPlan":[{"id":1,"title":"方案名","type":"scene","composition":"构图说明","logic":"补充逻辑","shootingTips":"拍摄技巧","imagePrompt":"detailed english scene description, travel photography, natural light, photorealistic","socialTags":["标签1","标签2"],"emoji":"📸"}],"inspireTips":[{"title":"构图标题","type":"技巧类型","description":"描述","bestTime":"最佳时机","phoneTip":"手机技巧","emoji":"🌅"}],"summary":"一句话总结"}

规则：expansionNodes 6个，generationPlan必须${planCount}个，type只能用scene/person/food/detail/vibe，inspireTips必须3个。`
  });

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 4000 }
        }),
      }
    );

    if (!resp.ok) {
      const err = await resp.json();
      return res.status(resp.status).json({ error: err.error?.message || 'Gemini API error' });
    }

    const data = await resp.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
    if (s === -1 || e === -1) return res.status(500).json({ error: 'AI未返回有效JSON，请重试' });

    const parsed = JSON.parse(cleaned.slice(s, e + 1));
    return res.status(200).json({ success: true, data: parsed });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

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
  const imageUrl = `data:${firstImage.mediaType || 'image/jpeg'};base64,${firstImage.data}`;

  const prompt = `Analyze this travel photo and output ONLY a JSON object, no other text.
Goal: ${goalTxt}, Style: ${style}, Total photos: ${imageCount}.

Each generationPlan needs a detailed "imagePrompt" in English describing scene/lighting/composition, ending with "travel photography, natural light, photorealistic".

Output this exact JSON structure (Chinese fields max 15 chars):
{"location":{"country":"国家","city":"城市","spot":"地点","confidence":"85%"},"environment":{"season":"季节","timeOfDay":"时段","weather":"天气","atmosphere":"氛围"},"subject":{"hasPersons":false,"personType":"","style":[],"mood":""},"expansionNodes":[{"emoji":"🍁","label":"延展方向","priority":"high"},{"emoji":"🌅","label":"方向2","priority":"high"},{"emoji":"🏯","label":"方向3","priority":"medium"},{"emoji":"🍵","label":"方向4","priority":"medium"},{"emoji":"🛍️","label":"方向5","priority":"low"},{"emoji":"📸","label":"方向6","priority":"low"}],"generationPlan":[{"id":1,"title":"方案名","type":"scene","composition":"构图","logic":"逻辑","shootingTips":"技巧","imagePrompt":"detailed english prompt, travel photography, natural light, photorealistic","socialTags":["tag1","tag2"],"emoji":"📸"}],"inspireTips":[{"title":"标题","type":"类型","description":"描述","bestTime":"时机","phoneTip":"技巧","emoji":"🌅"},{"title":"标题2","type":"类型","description":"描述","bestTime":"时机","phoneTip":"技巧","emoji":"📷"},{"title":"标题3","type":"类型","description":"描述","bestTime":"时机","phoneTip":"技巧","emoji":"🌿"}],"summary":"一句话总结"}

Rules: generationPlan must have exactly ${planCount} items, type must be one of: scene/person/food/detail/vibe. Output ONLY the JSON, nothing else.`;

  try {
    const submitRes = await fetch('https://api.replicate.com/v1/models/meta/llama-3.2-11b-vision-instruct/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait',
      },
      body: JSON.stringify({
        input: {
          image: imageUrl,
          prompt,
          max_tokens: 3000,
          temperature: 0.2,
          top_p: 0.9,
        }
      }),
    });

    if (!submitRes.ok) {
      const err = await submitRes.json();
      return res.status(submitRes.status).json({ error: err.detail || JSON.stringify(err) });
    }

    const prediction = await submitRes.json();
    let raw = '';

    if (prediction.status === 'succeeded' && prediction.output) {
      raw = Array.isArray(prediction.output) ? prediction.output.join('') : prediction.output;
    } else {
      const id = prediction.id;
      for (let i = 0; i < 40; i++) {
        await sleep(2000);
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
          headers: { 'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}` },
        });
        const poll = await pollRes.json();
        if (poll.status === 'succeeded') {
          raw = Array.isArray(poll.output) ? poll.output.join('') : (poll.output || '');
          break;
        }
        if (poll.status === 'failed') {
          return res.status(500).json({ error: poll.error || '分析失败' });
        }
      }
    }

    if (!raw) return res.status(500).json({ error: '未获得分析结果，请重试' });

    const cleaned = raw.replace(/```json|```/g, '').trim();
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
    if (s === -1 || e === -1) return res.status(500).json({ error: 'AI未返回有效JSON', raw: cleaned.slice(0, 200) });

    const parsed = JSON.parse(cleaned.slice(s, e + 1));
    return res.status(200).json({ success: true, data: parsed });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

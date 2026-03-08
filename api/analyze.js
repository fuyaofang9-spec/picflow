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

  try {
    // Upload image to get a URL
    const imageBuffer = Buffer.from(firstImage.data, 'base64');
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const mimeType = firstImage.mediaType || 'image/jpeg';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="content"; filename="photo.jpg"\r\nContent-Type: ${mimeType}\r\n\r\n`),
      imageBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploadRes = await fetch('https://api.replicate.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      return res.status(uploadRes.status).json({ error: 'Upload failed: ' + (err.detail || JSON.stringify(err)) });
    }
    const uploadData = await uploadRes.json();
    const imageUrl = uploadData.urls?.get;
    if (!imageUrl) return res.status(500).json({ error: '上传未返回URL' });

    // Use llama-3.2-11b-vision - much better at following JSON instructions
    const systemPrompt = `You are a travel photography analyst. You MUST output ONLY valid JSON, no explanations, no markdown, no extra text. Fill every field with real content based on the image.`;

    const userPrompt = `Look at this travel photo carefully. Output ONLY this JSON with all fields filled in based on what you actually see:

{
  "location": {"country": "actual country name", "city": "actual city", "spot": "specific location", "confidence": "90%"},
  "environment": {"season": "season you see", "timeOfDay": "time of day", "weather": "weather condition", "atmosphere": "mood/atmosphere"},
  "subject": {"hasPersons": true or false, "personType": "tourist/local/etc or empty", "style": ["style1","style2"], "mood": "mood"},
  "expansionNodes": [
    {"emoji": "🏛️", "label": "建筑探索", "priority": "high"},
    {"emoji": "🌅", "label": "光影变化", "priority": "high"},
    {"emoji": "🍽️", "label": "当地美食", "priority": "medium"},
    {"emoji": "👥", "label": "人文故事", "priority": "medium"},
    {"emoji": "🛍️", "label": "市集文化", "priority": "low"},
    {"emoji": "🌿", "label": "自然细节", "priority": "low"}
  ],
  "generationPlan": [
    {"id": 1, "title": "具体中文方案名", "type": "scene", "composition": "具体构图说明", "logic": "为什么补这张", "shootingTips": "具体拍摄技巧", "imagePrompt": "detailed English description of what to generate based on this location: architecture style, lighting, atmosphere, street scene, travel photography, natural light, photorealistic", "socialTags": ["tag1", "tag2", "tag3"], "emoji": "🏛️"},
    {"id": 2, "title": "具体中文方案名", "type": "person", "composition": "具体构图说明", "logic": "为什么补这张", "shootingTips": "具体拍摄技巧", "imagePrompt": "detailed English description, person in this location, travel photography, natural light, photorealistic", "socialTags": ["tag1", "tag2"], "emoji": "👤"},
    {"id": 3, "title": "具体中文方案名", "type": "detail", "composition": "具体构图说明", "logic": "为什么补这张", "shootingTips": "具体拍摄技巧", "imagePrompt": "detailed English close-up detail shot of this location, travel photography, natural light, photorealistic", "socialTags": ["tag1", "tag2"], "emoji": "🔍"}
  ],
  "inspireTips": [
    {"title": "构图技巧标题", "type": "构图", "description": "具体建议", "bestTime": "最佳拍摄时间", "phoneTip": "手机拍摄技巧", "emoji": "📐"},
    {"title": "光线技巧标题", "type": "光线", "description": "具体建议", "bestTime": "最佳时间", "phoneTip": "手机技巧", "emoji": "🌅"},
    {"title": "人文技巧标题", "type": "人文", "description": "具体建议", "bestTime": "最佳时间", "phoneTip": "手机技巧", "emoji": "👥"}
  ],
  "summary": "一句话描述这个地方和拍摄机会"
}

Goal: ${goalTxt}, Style preference: ${style}. generationPlan must have exactly ${planCount} items. Output ONLY the JSON object.`;

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
          system_prompt: systemPrompt,
          prompt: userPrompt,
          max_tokens: 3000,
          temperature: 0.1,
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
      for (let i = 0; i < 40; i++) {
        await sleep(2000);
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
          headers: { 'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}` },
        });
        const poll = await pollRes.json();
        if (poll.status === 'succeeded') {
          raw = Array.isArray(poll.output) ? poll.output.join('') : (poll.output || '');
          break;
        }
        if (poll.status === 'failed') return res.status(500).json({ error: poll.error || '分析失败' });
      }
    }

    if (!raw) return res.status(500).json({ error: '未获得分析结果，请重试' });

    const cleaned = raw.replace(/```json|```/g, '').trim();
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
    if (s === -1 || e === -1) return res.status(500).json({ error: 'AI未返回有效JSON', raw: cleaned.slice(0, 300) });

    const parsed = JSON.parse(cleaned.slice(s, e + 1));
    return res.status(200).json({ success: true, data: parsed });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

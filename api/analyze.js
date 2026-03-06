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
    // Step 1: Upload image via multipart/form-data to get a Replicate file URL
    const imageBuffer = Buffer.from(firstImage.data, 'base64');
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const mimeType = firstImage.mediaType || 'image/jpeg';
    const filename = 'photo.jpg';

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="content"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`),
      imageBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploadRes = await fetch('https://api.replicate.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      body,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      return res.status(uploadRes.status).json({ error: 'Upload failed: ' + (err.detail || JSON.stringify(err)) });
    }

    const uploadData = await uploadRes.json();
    const imageUrl = uploadData.urls?.get;
    if (!imageUrl) return res.status(500).json({ error: '上传未返回URL: ' + JSON.stringify(uploadData) });

    // Step 2: Run llava-13b with the uploaded image URL
    const prompt = `Analyze this travel photo and output ONLY a JSON object, no other text. Goal: ${goalTxt}, Style: ${style}.

Each generationPlan needs "imagePrompt" in English describing scene/lighting/composition ending with "travel photography, natural light, photorealistic".

Output JSON (Chinese fields max 15 chars):
{"location":{"country":"","city":"","spot":"","confidence":""},"environment":{"season":"","timeOfDay":"","weather":"","atmosphere":""},"subject":{"hasPersons":false,"personType":"","style":[],"mood":""},"expansionNodes":[{"emoji":"🍁","label":"","priority":"high"},{"emoji":"🌅","label":"","priority":"high"},{"emoji":"🏯","label":"","priority":"medium"},{"emoji":"🍵","label":"","priority":"medium"},{"emoji":"🛍️","label":"","priority":"low"},{"emoji":"📸","label":"","priority":"low"}],"generationPlan":[{"id":1,"title":"","type":"scene","composition":"","logic":"","shootingTips":"","imagePrompt":"english prompt, travel photography, natural light, photorealistic","socialTags":[],"emoji":"📸"}],"inspireTips":[{"title":"","type":"","description":"","bestTime":"","phoneTip":"","emoji":"🌅"},{"title":"","type":"","description":"","bestTime":"","phoneTip":"","emoji":"📷"},{"title":"","type":"","description":"","bestTime":"","phoneTip":"","emoji":"🌿"}],"summary":""}

generationPlan must have exactly ${planCount} items. type must be one of: scene/person/food/detail/vibe. Output ONLY JSON.`;

    const submitRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait',
      },
      body: JSON.stringify({
        version: "80537f9eead1a5bfa72d5ac6ea6414379be41d4d4f6679fd776e9535d1eb58bb",
        input: { image: imageUrl, prompt, max_tokens: 2000, temperature: 0.2 }
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
    if (s === -1 || e === -1) return res.status(500).json({ error: 'AI未返回有效JSON', raw: cleaned.slice(0, 200) });

    const parsed = JSON.parse(cleaned.slice(s, e + 1));
    return res.status(200).json({ success: true, data: parsed });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

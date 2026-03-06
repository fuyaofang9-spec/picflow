export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { images, goal, style, imageCount } = req.body;
  const planCount = goal === '4' ? 3 : goal === '9' ? 6 : 4;
  const goalTxt = { '4': '四宫格生成3张', '9': '九宫格生成6张', 'inspire': '拍照灵感4个' }[goal] || '四宫格生成3张';

  // Use first image as the reference
  const firstImage = (images || [])[0];
  if (!firstImage) return res.status(400).json({ error: '没有图片' });

  const imageUrl = `data:${firstImage.mediaType || 'image/jpeg'};base64,${firstImage.data}`;

  const prompt = `分析这张旅行照片，只输出JSON不要任何其他文字。目标:${goalTxt}，风格:${style}，共${imageCount}张图。

每个generationPlan的imagePrompt必须是详细英文，描述具体场景/光线/构图，结尾加"travel photography, natural light, photorealistic"。

输出格式（所有中文字段15字以内）:
{"location":{"country":"国家","city":"城市","spot":"地点","confidence":"85%"},"environment":{"season":"季节","timeOfDay":"时段","weather":"天气","atmosphere":"氛围"},"subject":{"hasPersons":false,"personType":"","style":[],"mood":""},"expansionNodes":[{"emoji":"🍁","label":"延展方向","priority":"high"}],"generationPlan":[{"id":1,"title":"方案名","type":"scene","composition":"构图说明","logic":"补充逻辑","shootingTips":"拍摄技巧","imagePrompt":"detailed english scene description, travel photography, natural light, photorealistic","socialTags":["标签1","标签2"],"emoji":"📸"}],"inspireTips":[{"title":"构图标题","type":"技巧类型","description":"描述","bestTime":"最佳时机","phoneTip":"手机技巧","emoji":"🌅"}],"summary":"一句话总结"}

规则：expansionNodes 6个，generationPlan必须${planCount}个，type只能用scene/person/food/detail/vibe，inspireTips必须3个。`;

  try {
    // Use llava-13b on Replicate for vision analysis
    const submitRes = await fetch('https://api.replicate.com/v1/models/yorickvp/llava-13b/predictions', {
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
          max_tokens: 2000,
          temperature: 0.3,
        }
      }),
    });

    if (!submitRes.ok) {
      const err = await submitRes.json();
      return res.status(submitRes.status).json({ error: err.detail || 'Replicate error' });
    }

    const prediction = await submitRes.json();

    // Get result - either immediate or poll
    let raw = '';
    if (prediction.status === 'succeeded' && prediction.output) {
      raw = Array.isArray(prediction.output) ? prediction.output.join('') : prediction.output;
    } else {
      // Poll
      const id = prediction.id;
      for (let i = 0; i < 30; i++) {
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

    if (!raw) return res.status(500).json({ error: '未获得分析结果' });

    const cleaned = raw.replace(/```json|```/g, '').trim();
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
    if (s === -1 || e === -1) return res.status(500).json({ error: 'AI未返回有效JSON，请重试' });

    const parsed = JSON.parse(cleaned.slice(s, e + 1));
    return res.status(200).json({ success: true, data: parsed });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

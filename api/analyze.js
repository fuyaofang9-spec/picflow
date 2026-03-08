export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { location, scene, style, goal } = req.body;
  const planCount = goal === '4' ? 4 : goal === '9' ? 9 : 4;

  const stylePrompt = {
    '不限':   'travel photography, natural light, photorealistic, 8k',
    '日系清新': 'Japanese photography style, soft pastel tones, film look, airy, light and clean',
    '胶片感':  'analog film grain, vintage film photography, warm faded tones, Kodak Portra look',
    '城市夜景': 'night photography, neon lights, long exposure, bokeh, urban nightscape',
    '自然风光': 'landscape photography, golden hour light, wide angle lens, vivid nature colors',
    '复古色调': 'vintage color grading, retro aesthetic, faded warm tones, nostalgic feel',
  }[style] || 'travel photography, natural light, photorealistic, 8k';

  // Call Together AI once to get BOTH location details AND inspire tips
  let locationDetails = {};
  let inspireTips = [];

  try {
    const resp = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        max_tokens: 1500,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: `You are an expert travel photographer who knows "${location}" very well. The user wants to photograph: "${scene}".

Output ONLY valid JSON with two parts:

{
  "locationDetails": {
    "architecture": "2-3 specific building/street features unique to ${location}",
    "clothing": "typical clothing styles seen here",
    "food": "3 specific iconic local dishes with visual details",
    "nature": "specific plants, mountains, water, sky features",
    "colors": "dominant color palette",
    "landmarks": "3 specific recognizable visual spots",
    "atmosphere": "the feeling and vibe",
    "details": "unique small details: signs, decorations, textures"
  },
  "inspireTips": [
    {
      "title": "具体地点+拍摄主题（如：外滩夜景长曝光）",
      "type": "夜景/构图/人文/美食/建筑/自然（选一个）",
      "description": "写3-4句具体的拍摄建议：去哪个具体位置、站在哪里、对着什么拍、会看到什么效果。要像一个熟悉当地的摄影师在告诉朋友怎么拍，非常具体实用",
      "bestTime": "具体时间段和原因（如：傍晚6-7点，此时华灯初上天空还有蓝调）",
      "phoneTip": "2-3个具体的手机拍摄技巧，包括具体参数或操作步骤",
      "spot": "具体地点名称",
      "emoji": "合适的emoji"
    },
    {
      "title": "第二个拍摄主题",
      "type": "类型",
      "description": "同样3-4句非常具体实用的建议",
      "bestTime": "具体时间和原因",
      "phoneTip": "2-3个具体操作步骤",
      "spot": "具体地点",
      "emoji": "emoji"
    },
    {
      "title": "第三个拍摄主题",
      "type": "类型",
      "description": "同样3-4句非常具体实用的建议",
      "bestTime": "具体时间和原因",
      "phoneTip": "2-3个具体操作步骤",
      "spot": "具体地点",
      "emoji": "emoji"
    },
    {
      "title": "第四个拍摄主题",
      "type": "类型",
      "description": "同样3-4句非常具体实用的建议",
      "bestTime": "具体时间和原因",
      "phoneTip": "2-3个具体操作步骤",
      "spot": "具体地点",
      "emoji": "emoji"
    },
    {
      "title": "第五个拍摄主题",
      "type": "类型",
      "description": "同样3-4句非常具体实用的建议",
      "bestTime": "具体时间和原因",
      "phoneTip": "2-3个具体操作步骤",
      "spot": "具体地点",
      "emoji": "emoji"
    }
  ]
}

Output ONLY the JSON, nothing else.`
        }],
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      const raw = data.choices?.[0]?.message?.content?.trim() || '';
      const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
      if (s !== -1 && e !== -1) {
        const parsed = JSON.parse(raw.slice(s, e + 1));
        locationDetails = parsed.locationDetails || {};
        inspireTips = parsed.inspireTips || [];
      }
    }
  } catch (e) {
    console.error('Research failed:', e.message);
  }

  // Fallback inspire tips if AI failed
  if (!inspireTips.length) {
    inspireTips = [
      { title: `${location}黄金时刻`, type: '光线', description: `日出后1小时和日落前1小时，前往${location}最具代表性的地标，此时光线柔美，建筑轮廓清晰`, bestTime: '日出后1小时 / 日落前1小时', phoneTip: '开启HDR，点击暗部区域测光', spot: location, emoji: '🌅' },
      { title: `${location}层次构图`, type: '构图', description: `寻找当地特色的前景元素，制造画面层次感`, bestTime: '全天均可', phoneTip: '开启网格线，用三分法构图', spot: location, emoji: '📐' },
      { title: `${location}人文抓拍`, type: '人文', description: `在集市街巷等待自然发生的真实瞬间`, bestTime: '早晨8-10点', phoneTip: '连拍模式，后期选最佳帧', spot: location, emoji: '👥' },
    ];
  }

  const typeConfigs = [
    { type: 'scene',  emoji: '🏛️', titleSuffix: '全景街道',
      buildPrompt: () => `Wide angle street view of ${location}, ${scene}. ${locationDetails.architecture || ''}. ${locationDetails.colors || ''} color palette. ${locationDetails.landmarks || ''}. ${locationDetails.atmosphere || ''}. ${stylePrompt}` },
    { type: 'person', emoji: '👤', titleSuffix: '人物故事',
      buildPrompt: () => `Person exploring ${location}, ${scene}. ${locationDetails.clothing || ''}. Background shows ${locationDetails.architecture || ''}. ${locationDetails.atmosphere || ''}. candid street photography, ${stylePrompt}` },
    { type: 'food',   emoji: '🍽️', titleSuffix: '美食特写',
      buildPrompt: () => `Close-up of ${locationDetails.food || `local food from ${location}`}. Traditional ${location} cuisine, rustic presentation. food photography, ${stylePrompt}` },
    { type: 'detail', emoji: '🔍', titleSuffix: '细节纹理',
      buildPrompt: () => `Macro detail of ${location}: ${locationDetails.details || locationDetails.architecture || ''}. ${locationDetails.colors || ''}. macro photography, ${stylePrompt}` },
    { type: 'vibe',   emoji: '🌅', titleSuffix: '空镜氛围',
      buildPrompt: () => `Empty atmospheric scene in ${location}, ${scene}. ${locationDetails.nature || ''}. ${locationDetails.atmosphere || ''}. No people, cinematic, ${stylePrompt}` },
    { type: 'scene',  emoji: '🌃', titleSuffix: '夜色街景',
      buildPrompt: () => `Night scene in ${location}, ${scene}. ${locationDetails.landmarks || ''}. neon lights, night photography, ${stylePrompt}` },
    { type: 'person', emoji: '🧍', titleSuffix: '生活瞬间',
      buildPrompt: () => `Local life moment in ${location}. ${locationDetails.clothing || ''}. ${locationDetails.atmosphere || ''}. documentary style, ${stylePrompt}` },
    { type: 'detail', emoji: '🌿', titleSuffix: '自然特写',
      buildPrompt: () => `Natural detail in ${location}: ${locationDetails.nature || ''}. ${locationDetails.colors || ''}. nature macro, ${stylePrompt}` },
    { type: 'food',   emoji: '☕', titleSuffix: '市井风情',
      buildPrompt: () => `Street market scene in ${location}, local vendors and stalls. ${locationDetails.atmosphere || ''}. ${locationDetails.colors || ''}. ${stylePrompt}` },
  ];

  const compositionTips = ['广角全景，展现整体空间感','中景人像，人与环境结合','俯拍特写，突出细节质感','微距构图，捕捉纹理','空景留白，营造氛围','逆光剪影，强调轮廓','框景构图，增加纵深','对称构图，突出建筑美','斜线构图，增加动感'];
  const shootingTipsArr = ['超广角寻找有前景的构图','人像模式虚化背景突出主体','自然光拍摄避免闪光灯','靠近开启微距模式','黄金时刻等待最佳光线','逆光时点击主体测光','寻找门框窗户作为框架','找对称轴居中构图','利用斜线引导视线'];

  const generationPlan = Array.from({ length: planCount }, (_, i) => {
    const cfg = typeConfigs[i % typeConfigs.length];
    return {
      id: i + 1,
      title: `${location}·${cfg.titleSuffix}`,
      type: cfg.type,
      composition: compositionTips[i % compositionTips.length],
      logic: `补充${cfg.titleSuffix}视角，丰富画面层次`,
      shootingTips: shootingTipsArr[i % shootingTipsArr.length],
      imagePrompt: cfg.buildPrompt(),
      socialTags: [location, scene, style === '不限' ? '旅行' : style],
      emoji: cfg.emoji,
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      location: { country: '', city: location, spot: scene, confidence: '100%' },
      environment: { season: '当季', timeOfDay: '全天', weather: '晴天', atmosphere: locationDetails.atmosphere || scene },
      subject: { hasPersons: false, personType: '', style: [style], mood: '' },
      expansionNodes: [
        { emoji: '🏛️', label: '建筑探索', priority: 'high' },
        { emoji: '🌅', label: '光影变化', priority: 'high' },
        { emoji: '🍽️', label: '当地美食', priority: 'medium' },
        { emoji: '👥', label: '人文故事', priority: 'medium' },
        { emoji: '🛍️', label: '市集文化', priority: 'low' },
        { emoji: '🌿', label: '自然细节', priority: 'low' },
      ],
      generationPlan,
      inspireTips,
      summary: `${location}·${scene}｜${locationDetails.atmosphere || style}`,
      locationDetails,
    }
  });
}

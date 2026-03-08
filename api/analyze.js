export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { location, scene, style, goal } = req.body;
  const planCount = goal === '4' ? 3 : goal === '9' ? 6 : 4;

  // Step 1: Use LLM to research location-specific visual details
  let locationDetails = { architecture: '', clothing: '', food: '', nature: '', colors: '', landmarks: '' };
  try {
    const researchResp = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        max_tokens: 400,
        temperature: 0.2,
        messages: [{
          role: 'user',
          content: `You are a travel expert. For the location "${location}" with scene "${scene}", provide specific visual details in JSON:
{
  "architecture": "specific building/street styles unique to this place (2-3 specific features)",
  "clothing": "typical local or tourist clothing styles seen here",
  "food": "2-3 specific iconic local dishes with visual description",
  "nature": "specific plants, mountains, water, sky features",
  "colors": "dominant color palette of this location",
  "landmarks": "2-3 specific recognizable visual elements",
  "atmosphere": "describe the feeling and vibe",
  "details": "unique small details: signs, decorations, textures"
}
Output ONLY the JSON, no other text.`
        }],
      }),
    });

    if (researchResp.ok) {
      const rd = await researchResp.json();
      const raw = rd.choices?.[0]?.message?.content?.trim() || '';
      const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
      if (s !== -1 && e !== -1) locationDetails = JSON.parse(raw.slice(s, e + 1));
    }
  } catch (e) {
    console.error('Research failed:', e.message);
  }

  const stylePrompt = {
    '不限': 'travel photography, natural light, photorealistic, 8k',
    '日系清新': 'Japanese photography style, soft pastel tones, film look, airy, light and clean',
    '胶片感': 'analog film grain, vintage film photography, warm faded tones, Kodak Portra look',
    '城市夜景': 'night photography, neon lights, long exposure, bokeh, urban nightscape',
    '自然风光': 'landscape photography, golden hour light, wide angle lens, vivid nature colors',
    '复古色调': 'vintage color grading, retro aesthetic, faded warm tones, nostalgic feel',
  }[style] || 'travel photography, natural light, photorealistic, 8k';

  const typeConfigs = [
    { type: 'scene',  emoji: '🏛️', titleSuffix: '全景街道', 
      buildPrompt: () => `Wide angle street view of ${location}, ${scene}. ${locationDetails.architecture}. ${locationDetails.colors} color palette. ${locationDetails.landmarks}. ${locationDetails.atmosphere}. ${stylePrompt}` },
    { type: 'person', emoji: '👤', titleSuffix: '人物故事',
      buildPrompt: () => `Person exploring ${location}, ${scene}. ${locationDetails.clothing}. Background shows ${locationDetails.architecture}. ${locationDetails.atmosphere}. candid street photography, ${stylePrompt}` },
    { type: 'food',   emoji: '🍽️', titleSuffix: '美食特写',
      buildPrompt: () => `Close-up of ${locationDetails.food || `local food from ${location}`}. Traditional ${location} cuisine, rustic presentation, served in local setting. food photography, ${stylePrompt}` },
    { type: 'detail', emoji: '🔍', titleSuffix: '细节纹理',
      buildPrompt: () => `Macro close-up detail of ${location}: ${locationDetails.details || locationDetails.architecture}. ${locationDetails.colors}. Textures and patterns unique to this place. macro photography, ${stylePrompt}` },
    { type: 'vibe',   emoji: '🌅', titleSuffix: '空镜氛围',
      buildPrompt: () => `Empty atmospheric scene in ${location}, ${scene}. ${locationDetails.nature}. ${locationDetails.atmosphere}. No people, cinematic composition, ${stylePrompt}` },
    { type: 'scene',  emoji: '🌃', titleSuffix: '另一视角',
      buildPrompt: () => `Different angle view of ${location}, ${scene}. ${locationDetails.landmarks}. ${locationDetails.colors}. ${stylePrompt}` },
  ];

  const generationPlan = Array.from({ length: planCount }, (_, i) => {
    const cfg = typeConfigs[i % typeConfigs.length];
    return {
      id: i + 1,
      title: `${location}·${cfg.titleSuffix}`,
      type: cfg.type,
      composition: ['广角全景，展现整体空间感', '中景人像，人与环境结合', '俯拍特写，突出食物细节', '微距细节，捕捉纹理质感', '空景构图，营造氛围感', '侧逆光，强调空间层次'][i % 6],
      logic: `补充${cfg.titleSuffix}角度，丰富画面层次`,
      shootingTips: ['用超广角寻找有前景的构图', '用人像模式虚化背景突出主体', '自然光拍摄避免闪光灯', '靠近拍摄开启微距模式', '黄金时刻等待最佳光线', '寻找框架构图增加纵深'][i % 6],
      imagePrompt: cfg.buildPrompt(),
      socialTags: [location, scene, style === '不限' ? '旅行' : style],
      emoji: cfg.emoji,
    };
  });

  const inspireTips = [
    { title: '黄金时刻构图', type: '光线', description: `${location}${locationDetails.atmosphere || ''}，日出后1小时和日落前1小时光线最柔美，${locationDetails.landmarks || '地标'}会呈现温暖金色调`, bestTime: '日出后1小时 / 日落前1小时', phoneTip: '开启HDR，点击暗部测光', emoji: '🌅' },
    { title: '层次感构图',   type: '构图', description: `寻找${location}特色的前景（${locationDetails.details || '栏杆、花卉、人群'}），制造画面层次让照片更有深度`, bestTime: '全天均可', phoneTip: '开启网格线，用三分法构图', emoji: '📐' },
    { title: '人文抓拍',     type: '人文', description: `${location}的${locationDetails.atmosphere || '日常生活'}是最真实的故事，在市场街巷等待自然发生的精彩瞬间`, bestTime: '早晨8-10点最有活力', phoneTip: '连拍模式捕捉动态瞬间', emoji: '👥' },
  ];

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { location, scene, style, goal } = req.body;
  const planCount = goal === '4' ? 3 : goal === '9' ? 6 : 4;

  // Build generation plans based on user input - no vision model needed
  const typeMap = ['scene', 'person', 'food', 'detail', 'vibe', 'scene'];
  const emojiMap = { scene:'🏛️', person:'👤', food:'🍽️', detail:'🔍', vibe:'🌅' };
  const titleMap = {
    scene: '全景场景',
    person: '人物故事',
    food: '美食特写',
    detail: '细节纹理',
    vibe: '空镜氛围',
  };

  const stylePrompt = {
    '不限': 'travel photography, natural light, photorealistic',
    '日系清新': 'Japanese style, soft pastel colors, film photography, airy and light',
    '胶片感': 'film grain, vintage film photography, warm tones, analog look',
    '城市夜景': 'city night photography, neon lights, long exposure, urban nightscape',
    '自然风光': 'landscape photography, golden hour, wide angle, nature photography',
    '复古色调': 'vintage color grading, retro tones, faded film look, nostalgic',
  }[style] || 'travel photography, natural light, photorealistic';

  const generationPlan = Array.from({ length: planCount }, (_, i) => {
    const type = typeMap[i % typeMap.length];
    const title = `${location}·${titleMap[type]}`;
    let imagePrompt = '';
    if (type === 'scene') imagePrompt = `Wide angle street scene in ${location}, ${scene}, beautiful architecture, atmospheric lighting, ${stylePrompt}`;
    else if (type === 'person') imagePrompt = `Traveler exploring ${location}, ${scene}, candid street photography, authentic moment, ${stylePrompt}`;
    else if (type === 'food') imagePrompt = `Local food and cuisine from ${location}, ${scene}, close-up food photography, ${stylePrompt}`;
    else if (type === 'detail') imagePrompt = `Close-up architectural detail in ${location}, ${scene}, textures and patterns, macro photography, ${stylePrompt}`;
    else imagePrompt = `Atmospheric empty street scene in ${location}, ${scene}, moody ambiance, cinematic, ${stylePrompt}`;

    return {
      id: i + 1,
      title,
      type,
      composition: type === 'scene' ? '广角全景，展现整体空间感' : type === 'person' ? '中景人像，人与环境结合' : type === 'food' ? '俯拍特写，突出食物细节' : type === 'detail' ? '微距细节，捕捉纹理质感' : '空景构图，营造氛围感',
      logic: `补充${titleMap[type]}角度，丰富九宫格层次`,
      shootingTips: type === 'scene' ? '使用超广角，寻找有前景的构图' : type === 'person' ? '用人像模式虚化背景，突出主体' : type === 'food' ? '自然光拍摄，避免闪光灯' : type === 'detail' ? '靠近拍摄，开启微距模式' : '黄金时刻拍摄，等待光线',
      imagePrompt,
      socialTags: [location, scene, style === '不限' ? '旅行' : style],
      emoji: emojiMap[type],
    };
  });

  const inspireTips = [
    {
      title: '黄金时刻构图',
      type: '光线',
      description: `在${location}，日出后1小时和日落前1小时光线最美，建筑和街道会呈现温暖金色调`,
      bestTime: '日出后1小时 / 日落前1小时',
      phoneTip: '开启HDR模式，用手指点击暗部对焦',
      emoji: '🌅',
    },
    {
      title: '层次感构图',
      type: '构图',
      description: `寻找${location}特色的前景元素（花卉、栏杆、人群），制造画面层次，让照片更有深度`,
      bestTime: '全天均可',
      phoneTip: '网格线辅助三分法，前景放在下三分之一',
      emoji: '📐',
    },
    {
      title: '人文抓拍',
      type: '人文',
      description: `${location}的日常生活是最真实的故事，在市场、街巷等待自然发生的精彩瞬间`,
      bestTime: '早晨8-10点，当地人活动最丰富',
      phoneTip: '连拍模式捕捉动态，后期选最佳帧',
      emoji: '👥',
    },
  ];

  const data = {
    location: { country: '', city: location, spot: scene, confidence: '100%' },
    environment: { season: '当季', timeOfDay: '全天', weather: '晴天', atmosphere: scene },
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
    summary: `${location}·${scene}，${style === '不限' ? '自然真实' : style}风格，${planCount}个创意方向等你探索`,
  };

  return res.status(200).json({ success: true, data });
}

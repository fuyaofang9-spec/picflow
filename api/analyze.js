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
        max_tokens: 2500,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: `You are a professional travel photographer who has lived in "${location}" for years and knows every corner of the city. The user wants to photograph: "${scene}".

Your task: give hyper-specific, locally-knowledgeable photography advice that ONLY applies to ${location}. Not generic tips.

Output ONLY valid JSON:

{
  "locationDetails": {
    "architecture": "specific building styles, materials, colors unique to ${location}",
    "clothing": "what locals and tourists typically wear here",
    "food": "3 most photogenic local dishes with exact visual description (color, texture, presentation, serving vessel)",
    "nature": "specific trees, flowers, mountains, rivers, sky conditions",
    "colors": "exact dominant colors of streets, walls, signs",
    "landmarks": "5 most iconic specific spots with exact names",
    "atmosphere": "precise vibe and feeling",
    "details": "unique small details: specific signage, door styles, textures, decorations"
  },
  "inspireTips": [
    {
      "title": "具体景点名+拍摄主题（如：鼓浪屿龙头路的老洋房晨光）",
      "type": "景点",
      "spot": "精确地点名称（具体到街道或建筑名）",
      "emoji": "🏛️",
      "description": "写4-5句极度具体的拍摄指南：①去到哪个精确位置②面朝哪个方向③画面里会出现什么元素④什么时候光线最好⑤预期的照片效果是什么。要像本地摄影师带朋友去拍一样具体",
      "bestTime": "精确时间段+原因（如：早上7-8点，游客少且有晨雾，光线从东侧打来形成丁达尔效应）",
      "phoneTip": "3个具体操作步骤（如：①打开专业模式ISO200②点击天空测光让建筑曝光准确③开启2秒定时避免抖动）",
      "hashtags": ["#地点相关标签1", "#地点相关标签2", "#地点相关标签3"]
    },
    {
      "title": "当地最上镜美食+拍摄方法（如：成都钵钵鸡的俯拍技巧）",
      "type": "美食",
      "spot": "推荐的具体店名或街道",
      "emoji": "🍜",
      "description": "4-5句：①这道菜的外观特点②最佳拍摄角度（俯拍/45度/平拍）③如何布置画面④用什么背景④预期效果",
      "bestTime": "几点去最好，为什么（光线/人流等）",
      "phoneTip": "3个具体步骤（如：①关闭闪光灯用窗边自然光②45度角拍让汤汁反光③用人像模式f1.8虚化桌面杂物）",
      "hashtags": ["#美食标签1", "#美食标签2", "#美食标签3"]
    },
    {
      "title": "标志性建筑/街道的最佳机位（如：上海武康路法桐隧道）",
      "type": "建筑",
      "spot": "精确地点",
      "emoji": "🏙️",
      "description": "4-5句极具体的机位建议：站在哪里、用什么焦段、等什么光线、画面构成是什么",
      "bestTime": "精确时间+原因",
      "phoneTip": "3个具体操作",
      "hashtags": ["#建筑标签1", "#建筑标签2", "#建筑标签3"]
    },
    {
      "title": "人文街拍的最佳地点（如：北京南锣鼓巷晨间生活）",
      "type": "人文",
      "spot": "精确街道或市场名",
      "emoji": "👥",
      "description": "4-5句：去哪个具体区域、找什么样的人或场景、如何不打扰被摄者、预期能拍到什么",
      "bestTime": "精确时间+人流规律",
      "phoneTip": "3个具体步骤",
      "hashtags": ["#人文标签1", "#人文标签2", "#人文标签3"]
    },
    {
      "title": "自然风光/夜景的秘密机位（如：厦门鼓浪屿日落观景台）",
      "type": "风光",
      "spot": "精确地点名",
      "emoji": "🌅",
      "description": "4-5句：精确位置、朝向、画面元素、光线条件、最佳季节",
      "bestTime": "精确时间+季节推荐",
      "phoneTip": "3个具体步骤（如：①开长曝光模式②用三脚架或靠墙固定③ISO调到最低减少噪点）",
      "hashtags": ["#风光标签1", "#风光标签2", "#风光标签3"]
    }
  ]
}

All descriptions must be hyper-specific to ${location}. Use real place names, real dish names, real street names. Output ONLY the JSON.`
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

  // Fallback
  if (!inspireTips.length) {
    inspireTips = [
      { title: `${location}地标晨光`, type: '景点', spot: location, emoji: '🏛️', description: `前往${location}最具代表性的地标，早晨光线柔和，游客稀少，是拍摄的最佳时机`, bestTime: '日出后1小时，光线最柔美', phoneTip: '①开启HDR模式②点击暗部测光③使用网格线辅助构图', hashtags: [`#${location}`, '#旅行摄影', '#风景'] },
    ];
  }

  const typeConfigs = [
    { type:'scene',  emoji:'🏛️', titleSuffix:'全景街道',  buildPrompt:()=>`Wide angle street view of ${location}, ${scene}. ${locationDetails.architecture||''}. ${locationDetails.colors||''} color palette. ${locationDetails.landmarks||''}. ${locationDetails.atmosphere||''}. ${stylePrompt}` },
    { type:'person', emoji:'👤', titleSuffix:'人物故事',  buildPrompt:()=>`Person exploring ${location}, ${scene}. ${locationDetails.clothing||''}. Background: ${locationDetails.architecture||''}. ${locationDetails.atmosphere||''}. candid photography, ${stylePrompt}` },
    { type:'food',   emoji:'🍽️', titleSuffix:'美食特写',  buildPrompt:()=>`${locationDetails.food||`Local food from ${location}`}. Traditional cuisine, authentic presentation. food photography, ${stylePrompt}` },
    { type:'detail', emoji:'🔍', titleSuffix:'细节纹理',  buildPrompt:()=>`Close-up detail of ${location}: ${locationDetails.details||locationDetails.architecture||''}. ${locationDetails.colors||''}. macro photography, ${stylePrompt}` },
    { type:'vibe',   emoji:'🌅', titleSuffix:'空镜氛围',  buildPrompt:()=>`Empty atmospheric scene in ${location}, ${scene}. ${locationDetails.nature||''}. ${locationDetails.atmosphere||''}. cinematic, ${stylePrompt}` },
    { type:'scene',  emoji:'🌃', titleSuffix:'夜色街景',  buildPrompt:()=>`Night scene in ${location}. ${locationDetails.landmarks||''}. neon lights, ${stylePrompt}` },
    { type:'person', emoji:'🧍', titleSuffix:'生活瞬间',  buildPrompt:()=>`Local daily life in ${location}. ${locationDetails.clothing||''}. ${locationDetails.atmosphere||''}. documentary style, ${stylePrompt}` },
    { type:'detail', emoji:'🌿', titleSuffix:'自然特写',  buildPrompt:()=>`Natural detail in ${location}: ${locationDetails.nature||''}. ${locationDetails.colors||''}. ${stylePrompt}` },
    { type:'food',   emoji:'☕', titleSuffix:'市井风情',  buildPrompt:()=>`Street market in ${location}, local vendors. ${locationDetails.atmosphere||''}. ${stylePrompt}` },
  ];

  const compositionArr = ['广角全景，展现整体空间感','中景人像，人与环境结合','俯拍特写，突出细节质感','微距构图，捕捉纹理','空景留白，营造氛围','逆光剪影，强调轮廓','框景构图，增加纵深','对称构图，突出建筑','斜线构图，增加动感'];
  const shootingArr    = ['超广角寻找有前景构图','人像模式虚化背景','自然光拍摄避免闪光灯','靠近开启微距模式','黄金时刻等最佳光线','逆光时点主体测光','寻找门框窗户作框架','找对称轴居中构图','利用斜线引导视线'];

  const generationPlan = Array.from({ length: planCount }, (_, i) => {
    const cfg = typeConfigs[i % typeConfigs.length];
    return {
      id: i + 1,
      title: `${location}·${cfg.titleSuffix}`,
      type: cfg.type,
      composition: compositionArr[i % compositionArr.length],
      logic: `补充${cfg.titleSuffix}视角，丰富画面层次`,
      shootingTips: shootingArr[i % shootingArr.length],
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
        { emoji:'🏛️', label:'建筑探索', priority:'high' },
        { emoji:'🌅', label:'光影变化', priority:'high' },
        { emoji:'🍽️', label:'当地美食', priority:'medium' },
        { emoji:'👥', label:'人文故事', priority:'medium' },
        { emoji:'🛍️', label:'市集文化', priority:'low' },
        { emoji:'🌿', label:'自然细节', priority:'low' },
      ],
      generationPlan,
      inspireTips,
      summary: `${location}·${scene}｜${locationDetails.atmosphere || style}`,
      locationDetails,
    }
  });
}

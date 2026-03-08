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

  // Use inspire tips to build location-specific plan spots
  const spotNames = inspireTips.map(t => t.spot).filter(Boolean);
  const landmark1 = spotNames[0] || locationDetails.landmarks?.split('，')[0] || location;
  const landmark2 = spotNames[1] || spotNames[0] || location;
  const landmark3 = spotNames[2] || spotNames[0] || location;

  const typeConfigs = [
    {
      type:'scene', emoji:'🏛️', titleSuffix:'全景地标',
      spot: landmark1,
      composition: `以${landmark1}为主体，采用广角镜头捕捉完整建筑轮廓，寻找人群或前景植物增加层次感`,
      shootingTips: `站在${landmark1}正对面或侧面45°，开启超广角模式，将天空留1/3，地面留2/3，用三分法构图`,
      logic: `${landmark1}是${location}最具代表性的视觉符号，是发圈必拍机位`,
      buildPrompt:()=>`Wide angle street view of ${location}, ${scene}. ${locationDetails.architecture||''}. ${locationDetails.colors||''} color palette. ${locationDetails.atmosphere||''}. ${stylePrompt}`
    },
    {
      type:'person', emoji:'👤', titleSuffix:'人物故事',
      spot: landmark2,
      composition: `在${landmark2}拍摄人物与环境的关系，人物占画面1/3，背景建筑占2/3，体现人在景中的故事感`,
      shootingTips: `用人像模式（f1.8-f2.8）虚化背景，让被摄者面向光源，在${landmark2}特色建筑前拍摄，避免正午强光`,
      logic: `有人物的画面更有温度，${landmark2}的建筑背景让照片具有强烈地域辨识度`,
      buildPrompt:()=>`Person exploring ${location}, ${scene}. ${locationDetails.clothing||''}. Background: ${locationDetails.architecture||''}. ${locationDetails.atmosphere||''}. candid photography, ${stylePrompt}`
    },
    {
      type:'food', emoji:'🍽️', titleSuffix:'美食特写',
      spot: `${location}特色餐厅`,
      composition: `${locationDetails.food ? `拍摄${locationDetails.food.split('，')[0]}` : `拍摄${location}特色美食`}，45度斜角突出食物立体感，用餐具和桌面营造用餐氛围`,
      shootingTips: `坐在靠窗位置用自然侧光，关闭闪光灯，食物刚上桌时立即拍（热气和新鲜感），iPhone用1.5倍焦段最佳`,
      logic: `美食是旅行内容中互动率最高的类型，${location}特色食物能引发强烈共鸣`,
      buildPrompt:()=>`${locationDetails.food||`Local food from ${location}`}. Traditional cuisine presentation, authentic local restaurant setting. food photography, ${stylePrompt}`
    },
    {
      type:'detail', emoji:'🔍', titleSuffix:'细节纹理',
      spot: landmark1,
      composition: `靠近${landmark1}的墙面、门窗、地砖，拍摄肉眼容易忽略的建筑细节，用极简构图突出单一元素`,
      shootingTips: `开启微距模式或2倍变焦，保持手机稳定，点击屏幕上的细节区域精准对焦，注意利用光影在纹理上的变化`,
      logic: `细节照片展示旅行者的观察力，与大众游客的打卡照形成差异化，提升内容质量感`,
      buildPrompt:()=>`Macro close-up of architectural details in ${location}: ${locationDetails.details||locationDetails.architecture||''}. ${locationDetails.colors||''}. macro photography, ${stylePrompt}`
    },
    {
      type:'vibe', emoji:'🌅', titleSuffix:'空镜氛围',
      spot: landmark3,
      composition: `在${landmark3}拍摄无人的纯景照，以天空、地面、远景三层构图，利用留白营造意境`,
      shootingTips: `清晨6-7点游客最少，此时光线柔和无阴影，手机横持用超广角，开HDR确保高光和暗部都有细节`,
      logic: `空镜氛围图适合作为九宫格的间隔帧，与有人物的照片形成节奏变化`,
      buildPrompt:()=>`Empty atmospheric scene in ${location}, ${scene}. ${locationDetails.nature||''}. ${locationDetails.atmosphere||''}. no people, cinematic composition, ${stylePrompt}`
    },
    {
      type:'scene', emoji:'🌃', titleSuffix:'夜色街景',
      spot: spotNames[3] || landmark1,
      composition: `夜晚在${spotNames[3]||landmark1}拍摄灯光街景，用车流或人流作为动态前景，固定机位拍出慢门效果`,
      shootingTips: `手机靠在栏杆或墙上固定，开启夜间模式，曝光时间设3-5秒，让灯光拉出光轨`,
      logic: `夜景是最容易出大片的题材，${location}夜晚的灯光氛围与白天形成强烈反差`,
      buildPrompt:()=>`Night scene in ${location}. ${locationDetails.landmarks||''}. neon lights, illuminated streets, ${stylePrompt}`
    },
    {
      type:'person', emoji:'🧍', titleSuffix:'生活瞬间',
      spot: spotNames[3] || `${location}街头`,
      composition: `在${spotNames[3]||location}街头抓拍当地人的日常瞬间，用中长焦保持距离，不干扰被摄者`,
      shootingTips: `切换到2倍变焦保持距离感，提前预判画面开连拍，后期从连拍中选最自然的表情和动作`,
      logic: `真实的人文瞬间是旅行内容最打动人的部分，展现目的地真实的生活温度`,
      buildPrompt:()=>`Local daily life in ${location}. ${locationDetails.clothing||''}. ${locationDetails.atmosphere||''}. documentary street photography, ${stylePrompt}`
    },
    {
      type:'detail', emoji:'🌿', titleSuffix:'自然特写',
      spot: spotNames[4] || location,
      composition: `拍摄${location}特有的植物、花卉或自然元素，以模糊背景突出主体，用光线在叶片或花瓣上的透射效果`,
      shootingTips: `逆光拍摄植物透光效果最佳，靠近到最近对焦距离，用人像模式让背景虚化，早晨有露水时更有质感`,
      logic: `自然细节为九宫格增添清新质感，与建筑和人物照片形成风格上的平衡`,
      buildPrompt:()=>`Natural detail in ${location}: ${locationDetails.nature||''}. ${locationDetails.colors||''}. ${stylePrompt}`
    },
    {
      type:'food', emoji:'☕', titleSuffix:'市井风情',
      spot: spotNames[1] || `${location}集市`,
      composition: `在${spotNames[1]||location}的集市或街边小摊，拍摄摊主劳作或食物摆放的场景，让画面有烟火气`,
      shootingTips: `用1倍标准镜头，纳入摊主、食物和周围环境，用高角度俯拍展示食物种类的丰富感`,
      logic: `集市和街边小吃是最能体现${location}在地文化的场景，具有强烈的生活气息`,
      buildPrompt:()=>`Street market scene in ${location}, local vendors and food stalls. ${locationDetails.atmosphere||''}. ${stylePrompt}`
    },
  ];

  const generationPlan = Array.from({ length: planCount }, (_, i) => {
    const cfg = typeConfigs[i % typeConfigs.length];
    return {
      id: i + 1,
      title: `${location}·${cfg.titleSuffix}`,
      type: cfg.type,
      spot: cfg.spot,
      composition: cfg.composition,
      logic: cfg.logic,
      shootingTips: cfg.shootingTips,
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { location, scene, type } = req.body;
  if (!location) return res.status(400).json({ error: 'location required' });

  const typeQueries = {
    scene:  `${location} ${scene} 风景 旅行`,
    person: `${location} ${scene} 人物 旅行`,
    food:   `${location} 美食 特色`,
    detail: `${location} ${scene} 建筑 细节`,
    vibe:   `${location} ${scene} 风景`,
  };
  const query = typeQueries[type] || `${location} ${scene} 旅行`;

  const API_KEY = process.env.GOOGLE_API_KEY;
  const CX = process.env.GOOGLE_CX;

  if (!API_KEY || !CX) {
    return res.status(500).json({ error: '缺少 GOOGLE_API_KEY 或 GOOGLE_CX 环境变量' });
  }

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX}&q=${encodeURIComponent(query)}&searchType=image&num=6&imgSize=large&safe=active&imgType=photo`;
    
    const resp = await fetch(url);
    const text = await resp.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch(e) {
      return res.status(500).json({ error: 'Google返回非JSON: ' + text.slice(0, 200) });
    }

    if (!resp.ok) {
      return res.status(resp.status).json({ 
        error: data.error?.message || 'Search failed',
        code: data.error?.code,
        status: data.error?.status,
      });
    }

    const items = (data.items || []).map(item => ({
      imageUrl: item.link,
      thumbUrl: item.image?.thumbnailLink || item.link,
      sourceUrl: item.image?.contextLink || '#',
      title: item.title,
      source: extractSource(item.image?.contextLink || ''),
    }));

    return res.status(200).json({ success: true, items, total: items.length });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function extractSource(url) {
  try {
    const host = new URL(url).hostname.replace('www.','');
    if (host.includes('xiaohongshu')) return '小红书';
    if (host.includes('weibo')) return '微博';
    if (host.includes('douyin')) return '抖音';
    if (host.includes('bilibili')) return 'B站';
    if (host.includes('instagram')) return 'Instagram';
    if (host.includes('pinterest')) return 'Pinterest';
    if (host.includes('unsplash')) return 'Unsplash';
    if (host.includes('flickr')) return 'Flickr';
    return host.split('.')[0];
  } catch { return '网络' }
}

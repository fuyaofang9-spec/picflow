export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const API_KEY = process.env.GOOGLE_API_KEY;
  const CX = process.env.GOOGLE_CX;

  const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX}&q=%E4%B8%BD%E6%B1%9F+%E9%A3%8E%E6%99%AF&searchType=image&num=3`;

  try {
    const resp = await fetch(url);
    const text = await resp.text();
    return res.status(200).json({
      status: resp.status,
      hasKey: !!API_KEY,
      hasCX: !!CX,
      cx: CX,
      response: text.slice(0, 500),
    });
  } catch(e) {
    return res.status(200).json({ error: e.message, hasKey: !!API_KEY, hasCX: !!CX });
  }
}

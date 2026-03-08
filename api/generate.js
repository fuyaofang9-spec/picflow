export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  // Retry up to 3 times on throttle
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(5000 * attempt); // wait 5s, 10s between retries

    try {
      const submitRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait',
        },
        body: JSON.stringify({
          input: {
            prompt,
            aspect_ratio: '1:1',
            num_outputs: 1,
            output_format: 'webp',
            output_quality: 80,
            num_inference_steps: 4,
          }
        }),
      });

      const prediction = await submitRes.json();

      // If throttled, retry
      if (submitRes.status === 429 || (prediction.detail && prediction.detail.toLowerCase().includes('throttl'))) {
        continue;
      }

      if (!submitRes.ok) {
        return res.status(submitRes.status).json({ error: prediction.detail || 'Replicate error' });
      }

      // Already done (Prefer: wait)
      if (prediction.status === 'succeeded' && prediction.output?.[0]) {
        return res.status(200).json({ url: prediction.output[0] });
      }

      // Poll
      for (let i = 0; i < 40; i++) {
        await sleep(2000);
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
          headers: { 'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}` },
        });
        const poll = await pollRes.json();
        if (poll.status === 'succeeded' && poll.output?.[0]) {
          return res.status(200).json({ url: poll.output[0] });
        }
        if (poll.status === 'failed') {
          return res.status(500).json({ error: poll.error || '生成失败' });
        }
      }
      return res.status(504).json({ error: '生成超时，请重试' });

    } catch (err) {
      if (attempt === 2) return res.status(500).json({ error: err.message });
    }
  }

  return res.status(429).json({ error: '请求频率过高，请稍后再试' });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

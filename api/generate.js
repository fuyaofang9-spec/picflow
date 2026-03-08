export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, location, scene, type } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  // Step 1: Use Together AI to enhance the prompt with location-specific details
  let enhancedPrompt = prompt;
  try {
    const enhanceResp = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        max_tokens: 300,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: `You are an expert travel photographer and AI image prompt writer. 
          
Location: ${location || 'unknown'}
Scene type: ${scene || ''}
Image type: ${type || 'scene'}
Base prompt: ${prompt}

Rewrite this into a highly detailed, specific image generation prompt that:
1. Includes SPECIFIC visual elements unique to ${location} (architecture style, clothing, food appearance, street characteristics, vegetation, colors)
2. Adds specific lighting and atmosphere details
3. Keeps it under 120 words
4. Ends with: photorealistic, travel photography, 8k

Output ONLY the enhanced prompt, nothing else.`
        }],
      }),
    });

    if (enhanceResp.ok) {
      const enhanceData = await enhanceResp.json();
      const enhanced = enhanceData.choices?.[0]?.message?.content?.trim();
      if (enhanced && enhanced.length > 20) {
        enhancedPrompt = enhanced;
      }
    }
  } catch (e) {
    // Fall back to original prompt if enhancement fails
    console.error('Prompt enhancement failed:', e.message);
  }

  // Step 2: Generate image with enhanced prompt using Replicate Flux
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(5000 * attempt);

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
            prompt: enhancedPrompt,
            aspect_ratio: '1:1',
            num_outputs: 1,
            output_format: 'webp',
            output_quality: 85,
            num_inference_steps: 4,
          }
        }),
      });

      const prediction = await submitRes.json();

      if (submitRes.status === 429 || prediction.detail?.toLowerCase().includes('throttl')) {
        continue;
      }
      if (!submitRes.ok) {
        return res.status(submitRes.status).json({ error: prediction.detail || 'Replicate error' });
      }
      if (prediction.status === 'succeeded' && prediction.output?.[0]) {
        return res.status(200).json({ url: prediction.output[0], enhancedPrompt });
      }

      // Poll
      for (let i = 0; i < 40; i++) {
        await sleep(2000);
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
          headers: { 'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}` },
        });
        const poll = await pollRes.json();
        if (poll.status === 'succeeded' && poll.output?.[0]) {
          return res.status(200).json({ url: poll.output[0], enhancedPrompt });
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

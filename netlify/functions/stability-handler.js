const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { type, payload } = JSON.parse(event.body);
    const { Stability_api_key } = process.env;

    if (type === 'stability') {
      const bodyPayload = {
        height: payload.height || 768,
        width: payload.width || 768,
        output_format: payload.output_format || 'webp',
        ...payload,
      };

      const response = await fetch("https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Stability_api_key}`,
        },
        body: JSON.stringify(bodyPayload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Stability AI Error');
      return { statusCode: 200, body: JSON.stringify(data) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request type. Only "stability" type is supported for image generation.' }) };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

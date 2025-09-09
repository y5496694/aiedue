const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { Stability_api_key } = process.env;
    const { prompt } = JSON.parse(event.body || '{}');

    const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'image/png',
        'Authorization': `Bearer ${Stability_api_key}`
      },
      body: JSON.stringify({
        text_prompts: [{ text: prompt }]
      })
    });

    const arrayBuffer = await response.arrayBuffer();
    if (!response.ok) {
      let errorMessage = 'Stability API Error';
      try {
        const errorData = JSON.parse(Buffer.from(arrayBuffer).toString('utf8'));
        errorMessage = errorData.error?.message || errorData.error || errorMessage;
      } catch (_) {}
      throw new Error(errorMessage);
    }

    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const result = { artifacts: [{ base64 }] };

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

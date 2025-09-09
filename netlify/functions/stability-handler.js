const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { type, payload } = JSON.parse(event.body);
    // 환경 변수 이름을 'Stability_api_key'로 수정했습니다.
    const { Stability_api_key } = process.env;

    if (type === 'stability') {
      const response = await fetch("https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 사용하는 변수명도 'Stability_api_key'로 수정했습니다.
          'Authorization': `Bearer ${Stability_api_key}`,
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Stability AI Error');
      return { statusCode: 200, body: JSON.stringify(data) };
    }

    return { statusCode: 400, body: 'Invalid request type. Only "stability" type is supported for image generation.' };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

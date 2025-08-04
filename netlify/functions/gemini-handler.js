const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // The GEMINI_API_KEY is securely accessed from Netlify's environment variables.
    const { GEMINI_API_KEY } = process.env;
    const payload = event.body; // The frontend payload is passed directly.

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });

    const data = await response.json();
    if (!response.ok) {
        // Forward the error message from Google's API if available
        throw new Error(data.error?.message || 'Gemini API Error');
    }

    return {
        statusCode: 200,
        body: JSON.stringify(data)
    };

  } catch (error) {
    return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
    };
  }
};

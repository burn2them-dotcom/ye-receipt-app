export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { mimeType, data, rawText } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: '서버 환경변수에 GEMINI_API_KEY가 설정되지 않았습니다.' });
    }

    const systemPrompt = `You are a data extraction assistant. I will provide an image or raw text of a receipt or bank statement. 
Extract the following information and return ONLY a JSON array containing exactly one object (or multiple if there are multiple transactions/receipts in one image) with the following schema:
[
  {
    "date": "YYYY-MM-DD",
    "vendor": "String (store name or transaction source)",
    "desc": "String (description of items or transaction)",
    "supply": Number (price without tax, 0 if not applicable),
    "tax": Number (tax amount, 0 if not applicable),
    "bank": "String (bank name, empty if receipt)",
    "acc": "String (account number, empty if receipt)",
    "holder": "String (account holder, empty if receipt)",
    "note": "String (any other notable info)"
  }
]
IMPORTANT: Return ONLY the JSON array. Do not wrap it in markdown code blocks like \`\`\`json. Return raw JSON text.`;

    const parts = [ { text: systemPrompt } ];
    if (mimeType && data) {
        parts.push({
            inlineData: { mimeType, data }
        });
    } else if (rawText) {
        parts.push({ text: `[Target Text To Parse]:\n${rawText}` });
    } else {
        return res.status(400).json({ error: '분석할 데이터가 제공되지 않았습니다.' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const payload = {
        contents: [{
            parts: parts
        }],
        generationConfig: {
            responseMimeType: "application/json"
        }
    };
    
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Gemini API 요청 중 오류가 발생했습니다.");
    }
    
    const responseData = await response.json();
    let textContent = responseData.candidates[0].content.parts[0].text;
    textContent = textContent.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    
    res.status(200).json({ result: textContent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

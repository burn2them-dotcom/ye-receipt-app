export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) {
            return res.status(400).json({ error: 'No image provided' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("GEMINI_API_KEY not set in Vercel Environment Variables");
            return res.status(500).json({ error: 'Server configuration error' });
        }

        const prompt = `
당신은 영수증 및 계좌 정보 추출 AI 전문가입니다.
첨부된 이미지를 분석하여 다음 필드들을 추출해 JSON 형식으로만 응답해 주세요. 마크다운(\`\`\`json 등)은 제외하고 오직 JSON 문자열만 반환해야 합니다.
해당 정보가 없다면 "" (빈 문자열) 또는 0 으로 채워주세요.

필드 규격:
- date: 날짜 (YYYY-MM-DD 형식)
- company: 구매업체 (가게 이름)
- details: 내용 (구매 품목 요약)
- supplyValue: 공급가액 (숫자만)
- tax: 세액 (숫자만)
- totalAmount: 총 금액 (숫자만)
- bankName: 은행명 (계좌번호가 있는 경우)
- accountNumber: 계좌번호 (숫자, 하이픈 포함)
- accountOwner: 예금주 (이름)
        `;

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: imageBase64
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.2,
                response_mime_type: "application/json",
            }
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Gemini API Error:", data);
            return res.status(500).json({ error: 'Failed to process image with AI' });
        }

        try {
            const textResponse = data.candidates[0].content.parts[0].text;
            const parsedJson = JSON.parse(textResponse);
            return res.status(200).json(parsedJson);
        } catch (parseError) {
            console.error("JSON Parsing Error:", parseError, "Raw Data:", data.candidates[0].content.parts[0].text);
            return res.status(500).json({ error: 'Failed to parse AI response' });
        }

    } catch (error) {
        console.error("Internal Server Error:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

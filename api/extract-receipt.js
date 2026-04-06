export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { receiptBase64, receiptText, bankBase64, bankText } = req.body;
        
        if (!receiptBase64 && !receiptText && !bankBase64 && !bankText) {
            return res.status(400).json({ error: 'No data provided. Please provide at least one image or text.' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("GEMINI_API_KEY not set in Vercel Environment Variables");
            return res.status(500).json({ error: 'Server configuration error' });
        }

        const prompt = `
당신은 영수증 및 은행 계좌 정보 통합 추출 AI 전문가입니다.
사용자가 제공한 여러 자료(영수증 사진/텍스트, 계좌 사진/텍스트)를 모두 종합 분석하여 다음 필드들을 추출해 JSON 형식으로만 응답해 주세요. 마크다운(\`\`\`json 등)은 제외하고 오직 JSON 문자열만 반환해야 합니다.
결측치(정보가 없는 경우)는 문자열의 경우 "" (빈 문자열), 숫자의 경우 0 으로 채워주세요.

자료가 혼재되어 있으니 영수증 관련 내용은 구매 내역으로, 은행/계좌 관련 내용은 예금주/송금 정보로 잘 분리해서 합쳐주세요.
만약 사용자가 직접 입력한 텍스트에 금액이나 이름이 있다면 영수증 이미지보다 우선해서 적용하세요.

필드 규격:
- date: 날짜 (YYYY-MM-DD 형식)
- company: 구매업체 (가게 이름)
- details: 내용 (구매 품목 요약)
- supplyValue: 공급가액 (숫자만)
- tax: 세액 (숫자만)
- totalAmount: 총 금액 (숫자만)
- bankName: 은행명
- accountNumber: 계좌번호 (숫자, 하이픈 포함)
- accountOwner: 예금주 (이름)
        `;

        // Build the parts array dynamically based on what was provided
        const parts = [{ text: prompt }];

        if (receiptText) {
            parts.push({ text: `[영수증 직접입력 내용]: ${receiptText}` });
        }
        if (bankText) {
            parts.push({ text: `[계좌정보 직접입력 내용]: ${bankText}` });
        }

        if (receiptBase64) {
            parts.push({
                inline_data: {
                    mime_type: "image/jpeg",
                    data: receiptBase64
                }
            });
        }
        if (bankBase64) {
            parts.push({
                inline_data: {
                    mime_type: "image/jpeg",
                    data: bankBase64
                }
            });
        }

        const requestBody = {
            contents: [
                {
                    parts: parts
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
            console.error("Gemini API HTTP Error:", data);
            return res.status(500).json({ error: `Gemini API Error: ${data.error?.message || 'Unknown error'}` });
        }

        try {
            const textResponse = data.candidates[0].content.parts[0].text;
            const parsedJson = JSON.parse(textResponse);
            return res.status(200).json(parsedJson);
        } catch (parseError) {
            console.error("JSON Parsing Error:", parseError, "Raw Data:", data?.candidates?.[0]?.content?.parts?.[0]?.text);
            return res.status(500).json({ error: 'Failed to parse AI response into JSON format.' });
        }

    } catch (error) {
        console.error("Internal Server Error:", error);
        return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
    }
}

import { GoogleGenAI } from '@google/genai';
 
let roundRobinCounter = 0;

export async function extension(req, res) {
    console.log('Received request:', JSON.stringify(req.body, null, 2));
    const fields = req.body.fields || [];
    const userData = req.body.userData || req.body.userdata || {};

    // Debug logging
    console.log('Received fields:', JSON.stringify(fields, null, 2));
    console.log('Received userData:', JSON.stringify(userData, null, 2));

    // Check if we have form fields
    if (!fields || fields.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'No form fields provided. Please include fields array in request body.',
            example: {
                fields: [
                    { name: "firstName", type: "text", label: "First Name", required: true },
                    { name: "email", type: "email", label: "Email Address", required: true }
                ],
                userData: {
                    firstName: "John",
                    lastName: "Doe",
                    email: "john.doe@example.com"
                }
            }
        });
    }

    const prompt = `You are an intelligent form-filling assistant. Your task is to analyze the provided form fields and fill them ONLY with values that can be derived from the user's personal information.

CRITICAL REQUIREMENTS:
- You MUST return a valid JSON object with field values
- ONLY fill fields if you can derive the value from the provided user data
- If user data does not contain information for a field, leave it as an empty string ""
- DO NOT make up or assume any data that is not provided in the user information
- DO NOT use placeholder values or defaults if user data is missing

STRICT RULES:
1. Only use data that is explicitly provided in the USER DATA section
2. If a field cannot be filled from user data, set its value to ""
3. Do not invent, assume, or create any fictional data
4. Return ONLY a valid JSON object with field names as keys and filled values as values
5. Do not include any explanatory text, only the JSON response

USER DATA AVAILABLE:
${JSON.stringify(userData, null, 2)}

FORM FIELDS TO FILL:
${fields.map(field => {
    const fieldName = field.questionText || field.field?.questionText || 'unknown';
    const fieldType = field.field?.inputType || field.inputType || 'text';
    const required = fieldName.includes('*');
    return `- Field Name: "${fieldName}" | Type: "${fieldType}" | Required: ${required}`;
}).join('\n')}

IMPORTANT: Use the exact field names (questionText) as keys in your JSON response.

FIELD MAPPING GUIDELINES (only if data exists in user data):
- Map user's educational information to qualification fields
- Map user's academic scores to percentage fields
- Map user's institution details to college/university fields
- Map user's technical skills/projects to technical achievement fields
- Map user's coding platform data to rating fields
- If no corresponding user data exists, use empty string ""

EXAMPLE OUTPUT (only fill what you know from user data):
{
  "Highest Qualification Year of Passing *": "",
  "College Name *": "",
  "UG % *": "",
  "Technical Achievements *": "",
  "Project *": ""
}

Return only the JSON object. Use empty strings for unknown fields.`;

    try {

        const apiKeys = [
            process.env.GEMINI_API_KEY_1,
            process.env.GEMINI_API_KEY_2
        ].filter(key => key);  

        if (apiKeys.length === 0) {
            throw new Error('No valid API keys found');
        }

        const keyIndex = roundRobinCounter % apiKeys.length;
        roundRobinCounter = (roundRobinCounter + 1) % apiKeys.length;
        
        console.log(`Using API key ${keyIndex + 1} (total requests processed: ${roundRobinCounter})`);

        let selectedKey = apiKeys[keyIndex];
        let attemptCount = 0;
        let lastError = null;

        while (attemptCount < apiKeys.length) {
            try {
                console.log(`Attempting API call with key ${(keyIndex + attemptCount) % apiKeys.length + 1} (attempt ${attemptCount + 1})`);
                
                const ai = new GoogleGenAI({
                    apiKey: selectedKey,
                });

                const response = await ai.models.generateContentStream({
                    model: 'gemini-2.0-flash-001',
                    contents: prompt,
                });

                console.log('response:', response); // Debug log
                let fullText = '';
                for await (const chunk of response) {
                    if (chunk.text) {
                        fullText += chunk.text;
                    }
                    console.log('Chunk received:', chunk.text); // Debug each chunk
                }

                console.log(`API call successful with key ${(keyIndex + attemptCount) % apiKeys.length + 1}`);
                console.log('Raw AI response:', fullText); // Debug log
                
                // Check if response is empty or just whitespace
                if (!fullText || fullText.trim().length === 0) {
                    throw new Error('Empty response from AI model');
                }
                
                // Parse the JSON response from Gemini
                try {
                    // Clean the response - extract JSON from the text
                    let cleanedText = fullText.trim();
                    
                    // Remove any markdown code block markers
                    cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
                    
                    // Try to find JSON object in the response
                    const jsonStart = cleanedText.indexOf('{');
                    const jsonEnd = cleanedText.lastIndexOf('}') + 1;
                    
                    if (jsonStart !== -1 && jsonEnd > jsonStart) {
                        cleanedText = cleanedText.substring(jsonStart, jsonEnd);
                    }
                    
                    console.log('Cleaned JSON text:', cleanedText); // Debug log
                    
                    // Check if cleaned text is just empty braces
                    if (cleanedText.trim() === '{}') {
                        throw new Error('AI returned empty JSON object');
                    }
                    
                    const filledData = JSON.parse(cleanedText);
                    
                    // Transform the AI response to match the required output format
                    const transformedData = fields.map(field => {
                        const questionText = field.questionText || field.field?.questionText || 'unknown';
                        const answer = filledData[questionText] || "";
                        
                        return {
                            field: {
                                element: field.field?.element || {},
                                questionText: questionText,
                                fieldType: field.field?.fieldType || 'input',
                                inputType: field.field?.inputType || 'text',
                                container: field.field?.container || {},
                                normalizedText: field.field?.normalizedText || questionText.toLowerCase()
                            },
                            answer: answer,
                            questionText: questionText,
                            matchType: field.matchType || "exact"
                        };
                    });
                    
                    res.status(200).json({
                        success: true,
                        data: transformedData,
                        // metadata: {
                        //     apiKeyUsed: (keyIndex + attemptCount) % apiKeys.length + 1,
                        //     totalAttempts: attemptCount + 1,
                        //     roundRobinPosition: roundRobinCounter,
                        //     modelUsed: 'gemini-2.0-flash-001'
                        // }
                    });
                    return;  
                } catch (parseError) {
                    console.error('Error parsing Gemini response:', parseError);
                    console.error('Full response text:', fullText); // Additional debug
                    res.status(500).json({
                        success: false,
                        message: 'Error parsing AI response',
                        error: parseError.message
                    });
                    return;
                }

            } catch (apiError) {
                console.error(`API call failed with key ${(keyIndex + attemptCount) % apiKeys.length + 1}:`, apiError.message);
                lastError = apiError;
                attemptCount++;
                
                if (attemptCount < apiKeys.length) {
                    const nextKeyIndex = (keyIndex + attemptCount) % apiKeys.length;
                    selectedKey = apiKeys[nextKeyIndex];
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        throw new Error(`All API keys failed. Last error: ${lastError?.message}`);

    } catch (error) {
        console.error('Error with Gemini API:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing form data with AI',
            error: error.message
        });
    }
}
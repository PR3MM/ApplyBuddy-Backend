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

    // Create enhanced field descriptions with proper options handling
    const enhancedFields = fields.map(field => {
        const questionText = field.questionText || field.field?.questionText || 'unknown';
        const fieldType = field.field?.inputType || field.inputType || 'text';
        const isRequired = questionText.includes('*');
        const options = field.options || [];
        
        return {
            questionText,
            fieldType,
            isRequired,
            options,
            hasOptions: options.length > 0
        };
    });

    const prompt = `You are an intelligent form-filling assistant. Your task is to analyze the provided form fields and fill them with the most appropriate values from the user's personal information.

CRITICAL REQUIREMENTS:
- You MUST return a valid JSON object with field names as keys and values as answers
- Use the EXACT field names (questionText) as provided in the form fields
- ONLY fill fields when you can confidently derive the value from user data
- If user data doesn't contain relevant information, use empty string ""
- For fields with specific options, you MUST choose from the available options only
- Do not invent, assume, or create any data not present in user information

USER DATA AVAILABLE:
${JSON.stringify(userData, null, 2)}

FORM FIELDS TO FILL:
${enhancedFields.map((field, index) => {
    let fieldInfo = `${index + 1}. Field Name: "${field.questionText}"`;
    fieldInfo += `\n   Type: ${field.fieldType}`;
    fieldInfo += `\n   Required: ${field.isRequired}`;
    
    if (field.hasOptions) {
        fieldInfo += `\n   Available Options: ${JSON.stringify(field.options)}`;
        fieldInfo += `\n   IMPORTANT: You MUST select EXACTLY one option from the list above`;
    } else {
        fieldInfo += `\n   Input Type: Free text - extract from user data`;
    }
    
    return fieldInfo;
}).join('\n\n')}

INTELLIGENT MATCHING RULES:

1. **PRN Number**: Look for "university prn number", "prn", "122B1B073" in user data
2. **College Name**: Must select from available options - look for "PCCOE" in user data and match to "Pimpri Chinchwad Education Trust's PCCOE, Pune"
3. **Name**: Look for "name", "Premved Dhote" in user data
4. **Mobile Number**: Look for "contact no", "8114482840" in user data (remove +91 or 0 prefix)
5. **Degree/Course**: Look for "course", "BE/ BTech" in user data
6. **Branch/Specialization**: Look for "stream", "CS" and map to appropriate branch
7. **Year of Passing**: Look for "ug passing year", "2026" in user data and select from options

SPECIFIC MATCHING FOR YOUR DATA:
- "ug passing year": "2026" → select "2026" from options
- "course": "BE/ BTech" → use directly
- "stream": "CS" → use directly
- "university prn number": "122B1B073" → use directly
- "name": "Premved Dhote" → use directly
- "contact no": "8114482840" → use directly
- College: User data suggests PCCOE → select "Pimpri Chinchwad Education Trust's PCCOE, Pune"

EXAMPLE OUTPUT FORMAT:
{
  "PRN Number  *": "122B1B073",
  "College Name *": "Pimpri Chinchwad Education Trust's PCCOE, Pune",
  "Name of the candidate *": "Premved Dhote",
  "10 Digit Mobile Number (Do NOT write +91 or 0) *": "8114482840",
  "Degree/ Course *": "BE/ BTech",
  "Branch/ Specialization *": "CS",
  "Year of Passing *": "2026"
}

FINAL INSTRUCTIONS:
- Return ONLY the JSON object, no other text
- For radio/dropdown fields, the answer MUST be from the provided options list
- Use exact field names including spaces and asterisks
- Match user data intelligently but stay within constraints`;

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

                console.log('response:', response);
                let fullText = '';
                for await (const chunk of response) {
                    if (chunk.text) {
                        fullText += chunk.text;
                    }
                    console.log('Chunk received:', chunk.text);
                }

                console.log(`API call successful with key ${(keyIndex + attemptCount) % apiKeys.length + 1}`);
                console.log('Raw AI response:', fullText);
                
                if (!fullText || fullText.trim().length === 0) {
                    throw new Error('Empty response from AI model');
                }
                
                try {
                    let cleanedText = fullText.trim();
                    cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
                    
                    const jsonStart = cleanedText.indexOf('{');
                    const jsonEnd = cleanedText.lastIndexOf('}') + 1;
                    
                    if (jsonStart !== -1 && jsonEnd > jsonStart) {
                        cleanedText = cleanedText.substring(jsonStart, jsonEnd);
                    }
                    
                    console.log('Cleaned JSON text:', cleanedText);
                    
                    if (cleanedText.trim() === '{}') {
                        throw new Error('AI returned empty JSON object');
                    }
                    
                    const filledData = JSON.parse(cleanedText);
                    console.log('AI Response Fields:', Object.keys(filledData));
                    console.log('AI Response Data:', filledData);
                    
                    // Transform the AI response to match the required output format
                    const transformedData = fields.map(field => {
                        const questionText = field.questionText || field.field?.questionText || 'unknown';
                        let answer = filledData[questionText] || "";
                        
                        // Enhanced matching logic
                        if (!answer && filledData) {
                            // Try exact match first
                            for (const [key, value] of Object.entries(filledData)) {
                                if (key === questionText) {
                                    answer = value;
                                    break;
                                }
                            }
                            
                            // If still no match, try normalized matching
                            if (!answer) {
                                const normalizedQuestionText = questionText.toLowerCase().replace(/\s+/g, ' ').trim();
                                for (const [key, value] of Object.entries(filledData)) {
                                    const normalizedKey = key.toLowerCase().replace(/\s+/g, ' ').trim();
                                    if (normalizedKey === normalizedQuestionText) {
                                        answer = value;
                                        console.log(`Matched "${questionText}" with "${key}": "${value}"`);
                                        break;
                                    }
                                }
                            }
                        }
                        
                        // Validate answer against options if they exist
                        const options = field.options || [];
                        if (options.length > 0 && answer && !options.includes(answer)) {
                            console.log(`Warning: Answer "${answer}" not in options for field "${questionText}"`);
                            console.log(`Available options:`, options);
                            // Try to find a close match
                            const lowerAnswer = answer.toLowerCase();
                            const matchedOption = options.find(opt => 
                                opt.toLowerCase().includes(lowerAnswer) || 
                                lowerAnswer.includes(opt.toLowerCase())
                            );
                            if (matchedOption) {
                                answer = matchedOption;
                                console.log(`Corrected to: "${answer}"`);
                            } else {
                                answer = ""; // Clear invalid answer
                            }
                        }
                        
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
                    
                    console.log('Transformed data:', JSON.stringify(transformedData, null, 2));
                    
                    res.status(200).json({
                        success: true,
                        data: transformedData
                    });
                    return;  
                } catch (parseError) {
                    console.error('Error parsing Gemini response:', parseError);
                    console.error('Full response text:', fullText);
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
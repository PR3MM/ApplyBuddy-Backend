import { GoogleGenAI } from '@google/genai';

let roundRobinCounter = 0;

export default async function handler(req, res) {
    try {
        // Enable CORS for serverless function
        res.setHeader('Access-Control-Allow-Credentials', true);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
        res.setHeader(
            'Access-Control-Allow-Headers',
            'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
        );

        // Handle preflight request
        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        // Only allow POST method
        if (req.method !== 'POST') {
            return res.status(405).json({
                success: false,
                message: 'Method not allowed. This endpoint only accepts POST requests.'
            });
        }

        // Extract data from request body
        const fields = req.body?.fields || [];
        const userData = req.body?.userData || req.body?.userdata || {};
        const formContext = req.body?.formContext || 'general';

        console.log('Received request - Fields count:', fields.length, 'Form context:', formContext);

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
                    },
                    formContext: "job_application"
                }
            });
        }

        // Create enhanced field descriptions
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

        // Build the AI prompt
        const buildPrompt = () => {
            const fieldDescriptions = enhancedFields.map((field, index) => {
                let fieldInfo = `${index + 1}. Field Name: "${field.questionText}"`;
                fieldInfo += `\n   Type: ${field.fieldType}`;
                fieldInfo += `\n   Required: ${field.isRequired}`;
                
                if (field.hasOptions) {
                    fieldInfo += `\n   Available Options: ${JSON.stringify(field.options)}`;
                    fieldInfo += `\n   SELECTION RULE: Must choose EXACTLY one option from above list`;
                } else {
                    fieldInfo += `\n   Input Type: Free text - extract from user data`;
                }
                
                return fieldInfo;
            }).join('\n\n');

            return `You are an intelligent universal form-filling assistant. Your task is to analyze ANY type of form and fill it with appropriate values from user data.

CRITICAL REQUIREMENTS:
- You MUST return a valid JSON object with field names as keys and values as answers
- Use the EXACT field names (questionText) as provided
- ONLY fill fields when you can confidently derive the value from user data
- If user data doesn't contain relevant information, use empty string ""
- For fields with specific options, you MUST choose from the available options only
- Do not invent, assume, or create any data not present in user information
- NEVER auto-fill sensitive fields like passwords, payment info, SSN, etc.

FORM CONTEXT: ${formContext}

USER DATA AVAILABLE:
${JSON.stringify(userData, null, 2)}

FORM FIELDS TO FILL:
${fieldDescriptions}

MATCHING RULES:
1. Name Fields: Look for keys containing "name", "first", "last", "full name", "candidate"
2. Email Fields: Look for keys containing "email", "e-mail", "mail"
3. Phone Fields: Look for keys containing "phone", "mobile", "contact", "number"
4. Date Fields: Look for keys containing "date", "birth", "dob"
5. Address Fields: Look for keys containing "address", "city", "state", "zip", "postal"
6. Education Fields: Look for "degree", "course", "qualification", "education"
7. Institution Fields: Look for "college", "university", "school", "institution"

SECURITY RULES:
- NEVER fill: passwords, credit cards, SSN, bank details, security codes
- BE CAUTIOUS with: financial info, government IDs, sensitive personal data
- ALWAYS validate options for dropdown/radio fields

OUTPUT FORMAT:
Return ONLY a JSON object with exact field names as keys:
{
  "Field Name 1": "answer1",
  "Field Name 2": "answer2",
  "Field Name 3": ""
}

FINAL INSTRUCTIONS:
- Use exact field names including all spaces, asterisks, and special characters
- For radio/dropdown fields, answer MUST be from provided options list
- Empty string for fields without sufficient user data
- No explanatory text, only JSON response
- Be intelligent but conservative - only fill what you're confident about`;
        };

        const prompt = buildPrompt();

        // Get API keys from environment variables
        const apiKeys = [
            process.env.GEMINI_API_KEY_1,
            process.env.GEMINI_API_KEY_2,
            process.env.GEMINI_API_KEY_3,
            process.env.GEMINI_API_KEY_4,
            process.env.GEMINI_API_KEY_5
        ].filter(key => key);

        if (apiKeys.length === 0) {
            throw new Error('No valid API keys found. Please set GEMINI_API_KEY environment variables.');
        }

        const keyIndex = roundRobinCounter % apiKeys.length;
        roundRobinCounter = (roundRobinCounter + 1) % apiKeys.length;

        let selectedKey = apiKeys[keyIndex];
        let attemptCount = 0;
        let lastError = null;

        // Retry logic with multiple API keys
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

                let fullText = '';
                for await (const chunk of response) {
                    if (chunk.text) {
                        fullText += chunk.text;
                    }
                }

                console.log(`API call successful with key ${(keyIndex + attemptCount) % apiKeys.length + 1}`);
                
                if (!fullText || fullText.trim().length === 0) {
                    throw new Error('Empty response from AI model');
                }
                
                // Parse and clean the AI response
                let cleanedText = fullText.trim();
                cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
                
                const jsonStart = cleanedText.indexOf('{');
                const jsonEnd = cleanedText.lastIndexOf('}') + 1;
                
                if (jsonStart !== -1 && jsonEnd > jsonStart) {
                    cleanedText = cleanedText.substring(jsonStart, jsonEnd);
                }
                
                if (cleanedText.trim() === '{}') {
                    throw new Error('AI returned empty JSON object');
                }
                
                const filledData = JSON.parse(cleanedText);
                
                // Transform and validate the AI response
                const transformedData = fields.map(field => {
                    const questionText = field.questionText || field.field?.questionText || 'unknown';
                    let answer = filledData[questionText] || "";
                    
                    // Enhanced matching with fuzzy logic
                    if (!answer && filledData) {
                        // Try exact match first
                        for (const [key, value] of Object.entries(filledData)) {
                            if (key === questionText) {
                                answer = value;
                                break;
                            }
                        }
                        
                        // Try normalized matching
                        if (!answer) {
                            const normalizedQuestionText = questionText.toLowerCase().replace(/\s+/g, ' ').trim();
                            for (const [key, value] of Object.entries(filledData)) {
                                const normalizedKey = key.toLowerCase().replace(/\s+/g, ' ').trim();
                                if (normalizedKey === normalizedQuestionText) {
                                    answer = value;
                                    break;
                                }
                            }
                        }
                    }
                    
                    // Validate against options and security rules
                    const options = field.options || [];
                    if (options.length > 0 && answer && !options.includes(answer)) {
                        // Find best semantic match
                        const lowerAnswer = answer.toLowerCase();
                        const matchedOption = options.find(opt => 
                            opt.toLowerCase().includes(lowerAnswer) || 
                            lowerAnswer.includes(opt.toLowerCase()) ||
                            opt.toLowerCase().replace(/[^a-z0-9]/g, '').includes(
                                lowerAnswer.replace(/[^a-z0-9]/g, '')
                            )
                        );
                        
                        if (matchedOption) {
                            answer = matchedOption;
                        } else {
                            answer = "";
                        }
                    }
                    
                    // Security check - don't fill sensitive fields
                    const sensitiveKeywords = ['password', 'ssn', 'social', 'credit', 'card', 'cvv', 'pin', 'bank'];
                    const isSensitive = sensitiveKeywords.some(keyword => 
                        questionText.toLowerCase().includes(keyword)
                    );
                    
                    if (isSensitive) {
                        answer = "";
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
                
                console.log('Successfully processed form data');
                
                return res.status(200).json({
                    success: true,
                    data: transformedData,
                    metadata: {
                        formContext: formContext,
                        fieldsProcessed: transformedData.length,
                        fieldsWithAnswers: transformedData.filter(item => item.answer).length
                    }
                });

            } catch (apiError) {
                console.error(`API call failed with key ${(keyIndex + attemptCount) % apiKeys.length + 1}:`, apiError.message);
                lastError = apiError;
                attemptCount++;
                
                if (attemptCount < apiKeys.length) {
                    const nextKeyIndex = (keyIndex + attemptCount) % apiKeys.length;
                    selectedKey = apiKeys[nextKeyIndex];
                    
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        throw new Error(`All API keys failed. Last error: ${lastError?.message}`);

    } catch (error) {
        console.error('Error processing extension request:', error);
        return res.status(500).json({
            success: false,
            message: 'Error processing form data with AI',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

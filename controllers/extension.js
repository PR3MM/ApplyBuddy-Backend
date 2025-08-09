import { GoogleGenAI } from '@google/genai';
 
let roundRobinCounter = 0;

export async function extension(req, res) {
    // console.log('req:', req);
    // console.log('Received request:', JSON.stringify(req.body, null, 2));
    const fields = req.body.fields || [];
    const userData = req.body.userData || req.body.userdata || {};
    const formContext = req.body.formContext || 'general'; // New: form type context

    // Debug logging
    // console.log('Received fields:', JSON.stringify(fields, null, 2));
    // console.log('Received userData:', JSON.stringify(userData, null, 2));
    // console.log('Form context:', formContext);

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
                formContext: "job_application" // or "registration", "survey", etc.
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

    // Generate context-aware matching rules
    const getContextualMatchingRules = (context, userData) => {
        const commonRules = `
UNIVERSAL MATCHING RULES:
1. **Name Fields**: Look for keys containing "name", "first", "last", "full name", "candidate"
2. **Email Fields**: Look for keys containing "email", "e-mail", "mail"
3. **Phone/Mobile Fields**: Look for keys containing "phone", "mobile", "contact", "number"
4. **Date Fields**: Look for keys containing "date", "birth", "dob"
5. **Address Fields**: Look for keys containing "address", "city", "state", "zip", "postal"
6. **Gender Fields**: Look for keys containing "gender", "sex"
        `;

        const contextRules = {
            job_application: `
ACADEMIC/JOB APPLICATION SPECIFIC RULES:
- **Education Fields**: Look for "degree", "course", "qualification", "education"
- **Institution Fields**: Look for "college", "university", "school", "institution"
- **Branch/Stream**: Look for "branch", "stream", "specialization", "major", "field"
- **Year/Passing**: Look for "year", "passing", "graduation", "expected"
- **Grades/Marks**: Look for "percentage", "cgpa", "gpa", "marks", "score"
- **Experience**: Look for "experience", "work", "internship", "job"
- **Skills**: Look for "skills", "technical", "programming", "languages"
            `,
            registration: `
REGISTRATION FORM SPECIFIC RULES:
- **Username**: Look for "username", "login", "handle"
- **Password**: Never auto-fill password fields for security
- **Preferences**: Look for "preference", "choice", "option"
- **Terms**: For checkboxes about terms, leave unchecked (user should manually accept)
            `,
            survey: `
SURVEY FORM SPECIFIC RULES:
- **Rating Fields**: Look for previous ratings or preferences
- **Multiple Choice**: Match based on user's past responses or preferences
- **Feedback**: Look for relevant opinions or comments in user data
            `,
            ecommerce: `
E-COMMERCE FORM SPECIFIC RULES:
- **Billing Address**: Look for "billing", "address", "street", "city"
- **Shipping Address**: Look for "shipping", "delivery"
- **Payment**: Never auto-fill payment details for security
- **Quantity**: Default to 1 or look for quantity preferences
            `
        };

        return commonRules + (contextRules[context] || '');
    };

    // Generate intelligent field analysis
    const generateFieldAnalysis = (userData) => {
        const dataKeys = Object.keys(userData);
        const analysis = [];
        
        // Categorize user data
        const categories = {
            personal: dataKeys.filter(key => 
                key.toLowerCase().includes('name') || 
                key.toLowerCase().includes('email') || 
                key.toLowerCase().includes('phone') || 
                key.toLowerCase().includes('contact') ||
                key.toLowerCase().includes('gender') ||
                key.toLowerCase().includes('date')
            ),
            academic: dataKeys.filter(key => 
                key.toLowerCase().includes('degree') || 
                key.toLowerCase().includes('college') || 
                key.toLowerCase().includes('university') || 
                key.toLowerCase().includes('course') ||
                key.toLowerCase().includes('grade') ||
                key.toLowerCase().includes('percentage') ||
                key.toLowerCase().includes('year')
            ),
            contact: dataKeys.filter(key => 
                key.toLowerCase().includes('address') || 
                key.toLowerCase().includes('city') || 
                key.toLowerCase().includes('state') ||
                key.toLowerCase().includes('zip')
            )
        };

        return `
USER DATA ANALYSIS:
Personal Info Keys: ${JSON.stringify(categories.personal)}
Academic Info Keys: ${JSON.stringify(categories.academic)}  
Contact Info Keys: ${JSON.stringify(categories.contact)}
All Available Keys: ${JSON.stringify(dataKeys)}
        `;
    };

    const prompt = `You are an intelligent universal form-filling assistant. Your task is to analyze ANY type of form and fill it with appropriate values from user data.

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

${generateFieldAnalysis(userData)}

FORM FIELDS TO FILL:
${enhancedFields.map((field, index) => {
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
}).join('\n\n')}

${getContextualMatchingRules(formContext, userData)}

INTELLIGENT MATCHING STRATEGY:
1. **Keyword Matching**: Look for similar words between field names and user data keys
2. **Semantic Understanding**: Understand what each field is asking for
3. **Context Awareness**: Use form context to make better matches
4. **Option Validation**: For dropdown/radio fields, find the best semantic match from options
5. **Data Type Matching**: Match field types (email→email, phone→phone, etc.)

SECURITY RULES:
- NEVER fill: passwords, credit cards, SSN, bank details, security codes
- BE CAUTIOUS with: financial info, government IDs, sensitive personal data
- ALWAYS validate options for dropdown/radio fields

EXAMPLE MATCHING LOGIC:
- Field "Full Name" + User data has "name": "John Doe" → "John Doe"
- Field "Email Address" + User data has "email": "john@example.com" → "john@example.com"  
- Field "College" with options [A, B, C] + User data suggests B → Select "B"
- Field "Year" with options [2024, 2025, 2026] + User data "graduation_year": "2025" → "2025"

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
        
        // console.log(`Using API key ${keyIndex + 1} (total requests processed: ${roundRobinCounter})`);

        let selectedKey = apiKeys[keyIndex];
        let attemptCount = 0;
        let lastError = null;

        while (attemptCount < apiKeys.length) {
            try {
                // console.log(`Attempting API call with key ${(keyIndex + attemptCount) % apiKeys.length + 1} (attempt ${attemptCount + 1})`);
                
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

                // console.log(`API call successful with key ${(keyIndex + attemptCount) % apiKeys.length + 1}`);
                // console.log('Raw AI response:', fullText);
                
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
                    
                    // console.log('Cleaned JSON text:', cleanedText);
                    
                    if (cleanedText.trim() === '{}') {
                        throw new Error('AI returned empty JSON object');
                    }
                    
                    const filledData = JSON.parse(cleanedText);
                    // console.log('AI Response Fields:', Object.keys(filledData));
                    // console.log('AI Response Data:', filledData);
                    
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
                                        // console.log(`Matched "${questionText}" with "${key}": "${value}"`);
                                        break;
                                    }
                                }
                            }
                        }
                        
                        // Validate against options and security rules
                        const options = field.options || [];
                        if (options.length > 0 && answer && !options.includes(answer)) {
                            // console.log(`Warning: Answer "${answer}" not in options for field "${questionText}"`);
                            // console.log(`Available options:`, options);
                            
                            // Find best semantic match
                            const lowerAnswer = answer.toLowerCase();
                            const matchedOption = options.find(opt => 
                                opt.toLowerCase().includes(lowerAnswer) || 
                                lowerAnswer.includes(opt.toLowerCase()) ||
                                // Additional fuzzy matching
                                opt.toLowerCase().replace(/[^a-z0-9]/g, '').includes(
                                    lowerAnswer.replace(/[^a-z0-9]/g, '')
                                )
                            );
                            
                            if (matchedOption) {
                                answer = matchedOption;
                                // console.log(`Corrected to: "${answer}"`);
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
                            // console.log(`Security: Skipping sensitive field "${questionText}"`);
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
                    
                    console.log('Transformed data:', JSON.stringify(transformedData, null, 2));
                    
                    res.status(200).json({
                        success: true,
                        data: transformedData,
                        metadata: {
                            formContext: formContext,
                            fieldsProcessed: transformedData.length,
                            fieldsWithAnswers: transformedData.filter(item => item.answer).length
                        }
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
import AsyncStorage from '@react-native-async-storage/async-storage';

const getApiKey = async () => {
  const storedKey = await AsyncStorage.getItem('@groqApiKey');
  return (storedKey || process.env.EXPO_PUBLIC_GROQ_API_KEY || '').trim();
};

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_INSTRUCTION = `You are a patient, encouraging English Teacher for a Ukrainian-speaking student. Use a supportive tone, always correct grammar errors, and suggest more natural phrasing. 
Every response MUST be a valid JSON object containing exactly these fields: { "message": "...", "correction": "...", "explanation": "..." }. 
If the user makes a mistake, put the corrected sentence in "correction" and the reason in "explanation". If no mistake, leave them as empty strings.
Do NOT include any text outside the JSON object. Return purely the JSON object.`;

const EMPTY_TUTOR_RESPONSE = { message: "", correction: "", explanation: "" };

const getReadableError = (error, fallback = 'Unexpected response from AI service.') => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || error.error?.message || JSON.stringify(error);
};

const normaliseTutorResponse = (rawContent) => {
  try {
    const parsed = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
    return {
      ...EMPTY_TUTOR_RESPONSE,
      ...(parsed && typeof parsed === 'object' ? parsed : { message: String(rawContent || '') }),
    };
  } catch (error) {
    return {
      ...EMPTY_TUTOR_RESPONSE,
      message: rawContent || 'I received a response, but could not read it. Please try again.',
    };
  }
};

const getHistoryText = (msg) => {
  if (!msg) return '';
  if (msg.parts?.[0]?.text) return msg.parts[0].text;
  if (typeof msg.content === 'string') return msg.content;
  if (msg.content?.message) return msg.content.message;
  if (msg.message) return msg.message;
  return '';
};

export const sendChatMessage = async (chatHistory, newMessage) => {
  const apiKey = await getApiKey();
  if (!apiKey) return { message: "API key missing. Please set it in the Settings screen.", correction: "", explanation: "" };
  
  try {
    // Map existing history format to OpenAI format
    const formattedHistory = chatHistory.map(msg => {
      const content = getHistoryText(msg);
      return {
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: content
      };
    }).filter(msg => msg.content);

    const messages = [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      ...formattedHistory,
      { role: 'user', content: newMessage }
    ];
    
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        response_format: { type: 'json_object' }
      })
    });
    
    const data = await response.json();

    if (!response.ok) {
      const errMsg = getReadableError(data.error || data, `Request failed with status ${response.status}`);
      console.error("Groq API Error:", data);
      return { message: `API Error: ${errMsg}`, correction: "", explanation: "" };
    }

    if (data.error) {
      console.error("Groq API Error:", data.error);
      const errMsg = getReadableError(data.error);
      return { message: `API Error: ${errMsg}`, correction: "", explanation: "" };
    }

    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) {
      console.error("Groq API Unexpected Response:", data);
      return { message: "AI service returned an empty response. Please try again.", correction: "", explanation: "" };
    }
    
    return normaliseTutorResponse(rawContent);
  } catch (error) {
    console.error("Groq Chat Error:", error);
    return { message: `Connection Error: ${getReadableError(error, 'Please check your internet connection.')}`, correction: "", explanation: "" };
  }
};

export const analyzeTaskImage = async (base64Image, promptText) => {
  const apiKey = await getApiKey();
  if (!apiKey) return "API key missing. Please set it in the Settings screen.";

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.2-11b-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText || "Analyze this English exercise, solve it, and explain the rules clearly. If the student is Ukrainian, you can use Ukrainian for explanations where it helps clarity." },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ],
      })
    });
    
    const data = await response.json();

    if (!response.ok) {
      const errMsg = getReadableError(data.error || data, `Request failed with status ${response.status}`);
      console.error("Groq Vision Error:", data);
      return "Error analyzing the task: " + errMsg;
    }

    if (data.error) {
      console.error("Groq Vision Error:", data.error);
      return "Error analyzing the task: " + getReadableError(data.error);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error("Groq Vision Unexpected Response:", data);
      return "The image service returned an empty response. Please try again.";
    }

    return content;
  } catch (error) {
    console.error("Groq Vision Exception:", error);
    return "Error analyzing the task: " + getReadableError(error, 'Please check your internet connection.');
  }
};

export const transcribeAudio = async (audioUri) => {
  const apiKey = await getApiKey();
  if (!apiKey) return "";
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: audioUri,
      name: 'audio.m4a',
      type: 'audio/m4a',
    });
    formData.append('model', 'whisper-large-v3-turbo');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });
    
    const data = await response.json();
    if (data.error) {
      console.error("Groq Whisper Error:", data.error);
      return "";
    }
    return data.text;
  } catch (error) {
    console.error("Groq Whisper Exception:", error);
    return "";
  }
};

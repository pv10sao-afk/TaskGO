import AsyncStorage from '@react-native-async-storage/async-storage';

const getApiKey = async () => {
  const storedKey = await AsyncStorage.getItem('@groqApiKey');
  return storedKey || process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
};

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_INSTRUCTION = `You are a patient, encouraging English Teacher for a Ukrainian-speaking student. Use a supportive tone, always correct grammar errors, and suggest more natural phrasing. 
Every response MUST be a valid JSON object containing exactly these fields: { "message": "...", "correction": "...", "explanation": "..." }. 
If the user makes a mistake, put the corrected sentence in "correction" and the reason in "explanation". If no mistake, leave them as empty strings.
Do NOT include any text outside the JSON object. Return purely the JSON object.`;

export const sendChatMessage = async (chatHistory, newMessage) => {
  const apiKey = await getApiKey();
  if (!apiKey) return { message: "API key missing. Please set it in the Settings screen.", correction: "", explanation: "" };
  
  try {
    // Map existing history format to OpenAI format
    const formattedHistory = chatHistory.map(msg => {
      let content = '';
      if (msg.role === 'model' || msg.role === 'assistant') {
        content = JSON.stringify(msg.content);
      } else {
        content = msg.content.message || msg.content;
      }
      return {
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: content
      };
    });

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
    if (data.error) {
      console.error("Groq API Error:", data.error);
      return { message: "Sorry, I had an error processing that.", correction: "", explanation: "" };
    }
    
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error("Groq Chat Error:", error);
    return { message: "Sorry, I had an error processing that.", correction: "", explanation: "" };
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
              { type: 'text', text: promptText || "Analyze this exercise, solve it, and explain the rules to the student." },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ],
      })
    });
    
    const data = await response.json();
    if (data.error) {
      console.error("Groq Vision Error:", data.error);
      return "Error analyzing the task: " + data.error.message;
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error("Groq Vision Exception:", error);
    return "Error analyzing the task.";
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

/**
 * Configuration file for the Chatbot App
 * Customize these settings based on your needs
 */

export const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },

  // OpenAI Configuration
  openai: {
    model: 'gpt-3.5-turbo',
    maxTokens: 500,
    temperature: 0.7,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },

  // Supabase Configuration
  supabase: {
    table: 'questions',
    contextLimit: 5, // Number of db questions to use as context
    resultLimit: 3,  // Number of db questions to return in response
  },

  // Chat Configuration
  chat: {
    systemPrompt: 'You are a helpful chatbot that answers questions based on provided context. Be concise and accurate in your responses.',
    timeout: 30000, // API timeout in milliseconds
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json', // 'json' or 'simple'
  },

  // Rate Limiting (optional)
  rateLimit: {
    enabled: false,
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
};

export default config;

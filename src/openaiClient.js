import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error('Missing OpenAI API key in environment variables');
}

export const openai = new OpenAI({
  apiKey: apiKey,
});

/**
 * Generate a response from OpenAI based on a question
 */
export async function generateResponse(question, context = '') {
  try {
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful chatbot that answers questions based on provided context. Be concise and accurate in your responses.',
      },
      {
        role: 'user',
        content: context 
          ? `Context: ${context}\n\nQuestion: ${question}`
          : question,
      },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating response from OpenAI:', error);
    throw error;
  }
}

/**
 * Generate a response with streaming
 */
export async function generateResponseStream(question, context = '') {
  try {
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful chatbot that answers questions based on provided context. Be concise and accurate in your responses.',
      },
      {
        role: 'user',
        content: context 
          ? `Context: ${context}\n\nQuestion: ${question}`
          : question,
      },
    ];

    const stream = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
      stream: true,
    });

    return stream;
  } catch (error) {
    console.error('Error generating streaming response from OpenAI:', error);
    throw error;
  }
}

export default openai;

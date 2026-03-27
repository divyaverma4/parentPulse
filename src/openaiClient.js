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
 * Use OpenAI to classify if a question is asking about grades/GPA
 */
export async function classifyQuestionIntent(question) {
  try {
    const classificationPrompt = `Determine if the following question is asking about the student's grades, GPA, average grade, or overall academic performance. 
    
Respond with ONLY "grade" if the question is about grades/GPA, or "other" if it's about something else.
Do not include any other text.

Question: "${question}"

Response:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: classificationPrompt,
        },
      ],
      max_tokens: 10,
      temperature: 0.0, // deterministic
    });

    const intent = response.choices[0]?.message?.content?.trim().toLowerCase();
    console.log(`[classifyQuestionIntent] Question: "${question}" -> Intent: ${intent}`);
    return intent === 'grade';
  } catch (error) {
    console.error('Error classifying question intent:', error);
    // Fall back to false if classification fails
    return false;
  }
}

/**
 * Generate a response from OpenAI based on a question
 */
export async function generateResponse(question, context = '') {
  try {
    const systemPrompt = `You are a helpful chatbot that answers questions about student grades based on provided context.

When a user asks about their "average grade", "GPA", "overall grade", or similar questions about grade averages, respond with a special format:
[API_CALL:AVERAGE_GRADE] followed by your normal response.

For example:
[API_CALL:AVERAGE_GRADE] Based on your current grades, your average GPA is calculated as follows...

For all other questions, provide a normal response based on the context provided. Be concise and accurate.`;

    const messages = [
      {
        role: 'system',
        content: systemPrompt,
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

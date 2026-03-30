# ParentPulse Chatbot

A JavaScript chatbot application with Supabase and OpenAI integration, featuring both API endpoints and a mobile-friendly web frontend.

## Features

- 🤖 AI-powered chatbot using OpenAI
- 📊 Student insights and analytics
- 📱 Mobile-responsive web interface
- 🔄 Real-time streaming responses
- 🗄️ Supabase database integration

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- Supabase account and project
- OpenAI API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables in `.env`:
   ```
   OPENAI_API_KEY=your_openai_api_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   PORT=3000
   ```

4. Start the server:
   ```bash
   npm start
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

### Web Interface

The mobile-friendly web interface allows you to:
- Enter your Student ID
- Chat with the AI assistant
- Get personalized responses based on your student data

### API Endpoints

- `GET /` - Web interface
- `GET /api/health` - Health check
- `POST /api/chat/ask` - Ask a question
- `GET /api/chat/insights/:studentUserId` - Get student insights
- `POST /api/chat/stream` - Stream AI response

## API Examples

### Ask a Question
```bash
curl -X POST http://localhost:3000/api/chat/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What is my average grade?","studentUserId":1}'
```

### Get Student Insights
```bash
curl http://localhost:3000/api/chat/insights/1
```

## Development

```bash
# Run in development mode with auto-restart
npm run dev

# Run tests
npm test
```

## Project Structure

```
├── public/           # Static web files
│   ├── index.html    # Mobile web interface
│   ├── styles.css    # Responsive styles
│   └── app.js        # Frontend JavaScript
├── src/
│   ├── index.js      # Express server
│   ├── chatbot.js    # Chatbot logic
│   ├── config.js     # Configuration
│   ├── openaiClient.js # OpenAI integration
│   ├── supabaseClient.js # Supabase integration
│   └── routes/
│       └── chat.js   # Chat API routes
├── examples/         # API usage examples
└── package.json
``` 

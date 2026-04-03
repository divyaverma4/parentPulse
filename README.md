# ParentPulse Chatbot

A JavaScript chatbot application with Supabase and OpenAI integration, featuring both API endpoints and a mobile-friendly web frontend.

## Features

- 🤖 AI-powered chatbot using OpenAI
- 📊 Student insights and analytics
- 📱 Mobile-responsive web interface
- 🔄 Real-time streaming responses
- 🗄️ Supabase database integration

## testing
### terminal 1 (backend)
- ngrok http 3000
- cd parent-pulse-backend
- npm start

copy ngrok link (not localhost) that pops up in new window. ex: Forwarding     https://ashlea-nonumbilical-superably.ngrok-free.dev -> http://localhost:3000

paste this apiBaseUrl link into ChatScreen function in parent-pulse/app/tabs/index.tsx file (line 34) 

### terminal 2 (frontend)
- cd parent-pulse
- npx expo start --clear
- s

On your mobile device, scan the QR code displayed in the terminal to run the frontend application in the ExpoGo mobile app.

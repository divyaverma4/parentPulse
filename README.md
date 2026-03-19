# TESTING
## 1. run server (press run in left-hand tool bar, or use 'npm run')
## 2. open terminal & use 'curl' or PowerShell to hit api endpoints (see examples)
### Powershell Example:
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/chat/ask" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"question":"What is my student's overall grade in math?","studentUserId":1}'
$response.response
### 'curl' Example:
curl.exe -X POST http://localhost:3000/api/chat/ask `
  -H "Content-Type: application/json" `
  -d '{"question":"What is my overall grade?","studentUserId":1}'

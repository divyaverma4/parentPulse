# TESTING
## 1. run server (press run in left-hand tool bar, or use 'npm run')
## 2. open terminal & use 'curl' or PowerShell to hit api endpoints (see examples)

### student 1
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/chat/ask" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"question":"What is my average grade in math?","studentUserId":1}'

$response | ConvertTo-Json -Depth 10

### student 2
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/chat/ask" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"question":"What is my average grade in math?","studentUserId":4}'

$response | ConvertTo-Json -Depth 10

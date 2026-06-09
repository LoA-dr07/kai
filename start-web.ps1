# Start KAI web app dev server and open browser
Set-Location "$PSScriptRoot\mobile"

# Open browser after short delay (server needs time to start)
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 6
    Start-Process "http://localhost:8081"
} | Out-Null

npx expo start --web

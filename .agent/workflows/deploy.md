---
description: Deploy the Jira Developer Reporter Forge App
---

1. Navigate to the static app directory
```bash
cd static/report-app
```

2. Build the static React application
// turbo
```bash
npm run build
```

3. Return to the root directory
```bash
cd ../..
```

4. Deploy using Forge CLI
// turbo
```bash
forge deploy
```

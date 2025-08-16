# FoodyBuddy Frontend

This is the core infrastructure for the FoodyBuddy AI Agent Frontend.
```bash
npm install
npm setup
npm run dev
```

Open the localhost link. Test functionality through the following links:

CHAT PAGE: http://localhost:5173/chat

## Changelog

08/16/2025 3:00PM CST - Added a .env.local README text file for instructions on local environment variables setup. Updated useChatStore.ts and socketClient.ts for integration with the backend.
NOTE: Remember to fix the hardcoded URL value and the rule-based responses in these files in future code optimization phases.

08/15/2025 11:45PM CST - Removed Login, Register, User Authentication functionalities.

08/15/2025 11:00AM CST - Completed: Project Foundation Setup; Core Chat System; User Authentication

Pending:

Test Cases: Jest test suite is incompatible with React 19, and is breaking the dev instance.

Backend-Frontend Integration: Pending due to WebSocket issues when connecting the backend server and API URLs.

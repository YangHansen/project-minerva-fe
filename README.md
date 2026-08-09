# Minerva frontend

Vue 3 + TypeScript workspace for scholarship discovery, applications, document review, IELTS practice, interview practice, and persistent AI chat.

## Local setup

1. Copy `.env.example` to `.env` and keep the API URL as `http://localhost:3000` for local development.
2. Start `project-minerva-be` first.
3. Install and run the frontend:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The browser talks only to the Minerva backend; the Elice API key must never be placed in a `VITE_*` variable or frontend source.

## Verification

```bash
npm run build
```

The production build runs Vue/TypeScript checks before generating `dist/`.

## Connected flows

- Cookie-based registration, login, logout, profile, and protected workspace routes
- Scholarship applications, checklist items, notes, documents, and document versions
- Persistent Terra chat with application context
- Terra document reviews and suggestion status
- Terra-generated interviews with Whisper transcription and answer feedback
- IELTS writing review and Whisper-backed speaking review

The payment screen is deliberately a pricing preview until a real payment provider and verified backend webhook are configured; it does not change the server token balance.

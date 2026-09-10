# Engage — Real-Time Audience Engagement Platform

> Made by **CyberHeathens** — IISER Bhopal Coding Club

## Features

- **6-Digit Room Code & QR Access** — Instant join, zero signup
- **Live Polling** — Single/multi-choice, multi-correct answer reveal, bar/pie charts
- **Q&A Text Wall** — Upvoting, moderation, pin/answer/hide controls
- **Animated Word Cloud** — NLP-powered keyword extraction
- **3 Views** — Participant (mobile), Presenter Console (desktop), Stage Display (projector)
- **Real-Time Sync** — Pusher WebSocket, sub-150ms latency

## Quick Start

### 1. Set up Neon DB
1. Go to [neon.tech](https://neon.tech) and create a free project
2. Copy the connection string to `.env` as `DATABASE_URL`

### 3. Set up Pusher
1. Go to [pusher.com](https://pusher.com) and create a free app
2. Copy App ID, Key, Secret, Cluster to `.env`
3. Copy Key and Cluster to `VITE_PUSHER_KEY` and `VITE_PUSHER_CLUSTER`

### 4. Run locally

```bash
# Terminal 1: API server
npm run dev:server

# Terminal 2: Frontend
npm run dev
```

### 5. Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

Set environment variables in Vercel dashboard.

## Tech Stack

- React 19 + TypeScript
- TailwindCSS 4
- Framer Motion
- Recharts
- Zustand
- Pusher (real-time)
- Neon (serverless Postgres)
- Vercel (hosting)

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Participant │────▶│  Vercel API  │────▶│  Neon DB    │
│  (Mobile)    │◀────│  Functions   │◀────│  (Postgres) │
└─────────────┘     └──────────────┘     └─────────────┘
       │                    │
       │              ┌─────┴─────┐
       └─────────────▶│  Pusher   │◀──── Presenter Console
                      │  (WS)     │◀──── Stage Display
                      └───────────┘
```

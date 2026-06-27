# BFHL Hierarchy Explorer

This repository contains a single Node.js application that serves both the API and the frontend.

## What it does

- `POST /bfhl` accepts `{ "data": ["A->B", "A->C"] }`
- Validates node entries, removes duplicate edges, handles first-parent-wins conflicts, detects cycles, and builds tree hierarchies
- Returns the required response shape with summary counts and identity fields
- Serves a polished single-page frontend from the same server

## Run locally

```bash
npm start
```

Then open `http://localhost:3000`.

## Identity fields

Set these environment variables before submitting to the evaluator:

- `BFHL_USER_ID`
- `BFHL_EMAIL_ID`
- `BFHL_COLLEGE_ROLL_NUMBER`

## Deployment

This app can be deployed as a single Node.js web service on Render, Railway, or any host that supports a long-running process.

## Notes

- CORS is enabled on `/bfhl`
- The API accepts `POST` requests with `Content-Type: application/json`
- The frontend calls the hosted API at the same origin
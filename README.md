# Firebase URL Shortener

A small Node.js URL shortener backed by Firestore.

## What it does

- Creates short codes for valid `http` and `https` URLs.
- Reuses an existing short code when the same long URL is submitted again.
- Redirects `/:shortCode` to the stored long URL.
- Runs locally with Node or as a Vercel serverless function.

## Setup

Install dependencies:

```sh
npm install
```

Create a Firebase project, enable Firestore, and generate a service-account key from Firebase project settings.

Create a local `.env` file:

```sh
cp .env.example .env
```

Then fill in one credential option.

Option 1: full JSON in one variable:

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"..."}
```

Option 2: split fields:

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Run locally

```sh
npm start
```

Open `http://localhost:3000`.

## Checks

```sh
npm run check
npm audit
```

## Deploy on Vercel

Add these environment variables in Vercel:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT` or both `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`
- Optional: `FIRESTORE_COLLECTION`

The included `vercel.json` routes all requests to `index.js`.

## Security

Do not commit Firebase service-account JSON files. If a key has ever been pushed to GitHub, delete that key in Google Cloud IAM/Firebase and generate a new one. Removing the file from the current branch does not remove it from Git history.

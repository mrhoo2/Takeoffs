# Deployment Guide

## Overview
Your application is split into two parts:
- **Frontend**: Next.js app deployed on Vercel
- **Backend**: FastAPI app deployed on Render

## Backend Deployment (Render)

Your backend is already deployed at: https://bv-takeoffs.onrender.com

Make sure you have set these environment variables in Render:
- `GEMINI_API_KEY`
- `OPUS_API_KEY`

## Frontend Deployment (Vercel)

### Prerequisites
1. Vercel account (you already have one)
2. Vercel CLI installed (optional, can also deploy via web interface)

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

3. Login to Vercel:
   ```bash
   vercel login
   ```

4. Deploy:
   ```bash
   vercel
   ```
   - Follow the prompts
   - When asked about settings, accept the defaults
   - The build command should be: `npm run build`
   - The output directory should be: `.next`

5. Set the production environment variable in Vercel:
   ```bash
   vercel env add NEXT_PUBLIC_API_URL production
   ```
   Then enter: `https://bv-takeoffs.onrender.com`

6. Deploy to production:
   ```bash
   vercel --prod
   ```

### Option 2: Deploy via Vercel Web Interface

1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Import your Git repository
4. Set the root directory to `frontend`
5. Vercel will auto-detect Next.js settings
6. Before deploying, add environment variable:
   - Key: `NEXT_PUBLIC_API_URL`
   - Value: `https://bv-takeoffs.onrender.com`
   - Environment: Production
7. Click "Deploy"

### Important Notes

- The `.env.local` file is for local development only and is not committed to Git
- The `.env.production` file contains the production API URL and will be used during build
- The environment variable `NEXT_PUBLIC_API_URL` must be set in Vercel's dashboard/CLI for production

### Verifying the Deployment

After deployment:
1. Visit your Vercel URL: https://bvtakeoffs.vercel.app
2. Test uploading a schedule - it should connect to your Render backend
3. Check the browser console for any CORS errors
4. Check Render logs to see if requests are coming through

### Troubleshooting

**CORS Errors:**
- Make sure your Render backend is running
- Check that the CORS settings in `backend/main.py` include your Vercel URL
- Verify the environment variable is set correctly in Vercel

**Build Errors:**
- Check that all dependencies are in `package.json`
- Ensure Node version compatibility (Vercel uses Node 18+ by default)

**API Connection Issues:**
- Verify `NEXT_PUBLIC_API_URL` is set in Vercel
- Check that Render backend is not sleeping (free tier sleeps after inactivity)
- Test the backend directly: https://bv-takeoffs.onrender.com

### Updating the Application

When you make changes:
1. Commit and push to Git
2. Vercel will automatically redeploy (if connected to Git)

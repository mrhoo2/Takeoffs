# How to Manually Redeploy on Render

## Method 1: Manual Redeploy from Dashboard (Recommended)

1. Go to https://dashboard.render.com
2. Click on your `bv-takeoffs` service
3. In the top right, click the **"Manual Deploy"** button
4. Select **"Deploy latest commit"** from the dropdown
5. Click **"Deploy"**

The service will rebuild and redeploy using your latest GitHub commit.

## Method 2: Use Render CLI

If you have the Render CLI installed:

```bash
render deploy --service bv-takeoffs
```

## Method 3: Trigger via Webhook (if configured)

If you have a deploy webhook set up, you can trigger it with:

```bash
curl -X POST https://api.render.com/deploy/[your-webhook-id]
```

## Checking Deployment Status

After triggering the deploy:
1. Stay on the service page in Render dashboard
2. Click on the **"Logs"** tab
3. Watch the build process in real-time
4. Look for these key indicators:
   - ✅ `==> Running build command 'pip install -r requirements.txt'...`
   - ✅ `Successfully installed [packages]...`
   - ✅ `==> Build succeeded`
   - ✅ `Your service is live 🎉`

## Common Issues

**If build still fails:**
- Verify `backend/requirements.txt` exists in your repository
- Check that environment variables are set in Render dashboard:
  - `GEMINI_API_KEY`
  - `OPUS_API_KEY`
- Make sure the "Build Command" is set to: `pip install -r requirements.txt`
- Make sure the "Start Command" is set to: `uvicorn main:app --host 0.0.0.0 --port $PORT`

**If service is taking too long:**
- Render free tier can take 5-10 minutes to deploy

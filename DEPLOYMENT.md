# 🚀 Deploying Supply-Bot to Production

This guide walks you through deploying Supply-Bot for public access.

## Quick Start (Recommended Stack)

| Component | Service | Cost |
|-----------|---------|------|
| Frontend | Vercel | Free |
| Backend | Railway | $5/mo |
| Database | Supabase | Free |
| Redis | Upstash | Free |
| Email | Resend | Free (3K/mo) |

**Total: ~$5/month** (or free if under Railway limits)

---

## Step 1: Database Setup (Supabase)

1. Go to [supabase.com](https://supabase.com) and create account
2. Create new project → Choose region → Set password
3. Wait for project to spin up (~2 min)
4. Go to **Settings → Database → Connection String**
5. Copy the URI (looks like): 
   ```
   postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
6. Replace `[PASSWORD]` with your database password

---

## Step 2: Redis Setup (Upstash)

1. Go to [upstash.com](https://upstash.com) and create account
2. Create new Redis database → Choose region
3. Copy the **Redis URL** from dashboard:
   ```
   rediss://default:xxxxx@us1-xxxxx.upstash.io:6379
   ```

---

## Step 3: Email Setup (Resend)

1. Go to [resend.com](https://resend.com) and create account
2. Add and verify your domain (or use their test domain)
3. Go to **API Keys → Create API Key**
4. Your SMTP settings:
   ```
   Host: smtp.resend.com
   Port: 465
   User: resend
   Password: re_xxxxxxxx (your API key)
   ```

---

## Step 4: Deploy Backend (Railway)

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project → Deploy from GitHub Repo**
3. Select your `supply-bot` repository
4. Railway auto-detects Node.js

### Configure Environment Variables:
Click on your service → **Variables** → Add these:

```env
DATABASE_URL=postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
GROK_API_KEY=gsk_xxxxxxxx
GROK_MODEL=grok-beta
GROK_BASE_URL=https://api.x.ai/v1
EMAIL_HOST=smtp.resend.com
EMAIL_PORT=465
EMAIL_USER=resend
EMAIL_PASSWORD=re_xxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
API_SECRET=<run: openssl rand -hex 32>
NODE_ENV=production
PORT=3001
```

### Add Start Command:
In **Settings → Deploy**, set:
- **Build Command:** `npm install && npx prisma generate && npx prisma db push && npm run build`
- **Start Command:** `npm start`

5. Copy your Railway URL (e.g., `https://supply-bot-production.up.railway.app`)

---

## Step 5: Deploy Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project**
3. Import your `supply-bot` repository
4. **Important:** Set the Root Directory to `dashboard`

### Configure Environment Variables:
```env
NEXT_PUBLIC_API_URL=https://your-railway-url.up.railway.app
```

5. Click **Deploy**
6. Your dashboard is now live at `https://your-app.vercel.app`

---

## Step 6: Update CORS (Railway)

Go back to Railway and add:
```env
CORS_ORIGIN=https://your-app.vercel.app
FRONTEND_URL=https://your-app.vercel.app
```

---

## Step 7: Initialize Database

Option A: Via Railway CLI
```bash
railway run npx prisma db push
railway run npm run seed
```

Option B: Connect directly with Prisma
```bash
DATABASE_URL="your-supabase-url" npx prisma db push
DATABASE_URL="your-supabase-url" npm run seed
```

---

## 🎉 Done!

Your Supply-Bot is now live:
- **Dashboard:** https://your-app.vercel.app
- **API:** https://your-railway-url.up.railway.app

---

## Custom Domain (Optional)

### For Frontend (Vercel):
1. Go to Project Settings → Domains
2. Add your domain (e.g., `app.yourcompany.com`)
3. Add DNS records as instructed

### For Backend (Railway):
1. Go to Service Settings → Networking → Custom Domain
2. Add domain (e.g., `api.yourcompany.com`)
3. Add CNAME record

---

## Production Checklist

- [ ] Database URL configured
- [ ] Redis URL configured  
- [ ] Grok API key set
- [ ] Email service configured
- [ ] Strong API_SECRET generated (`openssl rand -hex 32`)
- [ ] CORS_ORIGIN matches frontend URL
- [ ] Database migrations applied
- [ ] Test login works
- [ ] Test email sending works

---

## Monitoring & Logs

- **Railway:** Dashboard → Deployments → Logs
- **Vercel:** Dashboard → Functions → Logs
- **Supabase:** Dashboard → Logs

---

## Scaling Notes

As you grow:

| Users | Upgrade To |
|-------|------------|
| 1-100 | Free tier works |
| 100-1K | Railway Pro ($20/mo), Supabase Pro ($25/mo) |
| 1K+ | Dedicated infrastructure |

---

## Troubleshooting

### "Database connection failed"
- Check DATABASE_URL has `?sslmode=require` at end
- Verify password has no special chars that need encoding

### "Redis connection failed"
- Use `rediss://` (with double s) for TLS
- Check Upstash allows connections from Railway IPs

### "Emails not sending"
- Verify domain in Resend
- Check API key is correct
- Look at Resend dashboard for errors

### "CORS errors"
- Ensure CORS_ORIGIN exactly matches your Vercel URL
- Include protocol: `https://your-app.vercel.app`

# 🎤 Townhall Live — Interactive Q&A Tool

A real-time live polling and word cloud app for your townhall sessions. Supports up to 100+ participants.

---

## 📁 Files in This Project

```
townhall-app/
├── server.js          ← The backend server
├── package.json       ← App config
└── public/
    ├── index.html     ← Participant page (phone)
    ├── display.html   ← Big screen display
    └── control.html   ← Your control panel
```

---

## 🚀 Deploy to Render (Free) — Step by Step

### STEP 1: Upload to GitHub

1. Go to **github.com** and log in
2. Click the **+** button (top right) → **New repository**
3. Name it `townhall-live`, set to **Public**, click **Create repository**
4. On the next page, click **uploading an existing file**
5. Upload ALL files (keep the folder structure — drag the whole folder)
6. Click **Commit changes**

---

### STEP 2: Deploy on Render

1. Go to **render.com** → Sign up with your GitHub account
2. Click **New +** → **Web Service**
3. Connect your GitHub account if prompted
4. Select your `townhall-live` repository
5. Fill in the settings:
   - **Name**: `townhall-live` (or anything you like)
   - **Region**: Singapore
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free
6. Click **Create Web Service**
7. Wait 2–3 minutes for it to deploy
8. You'll get a URL like: `https://townhall-live.onrender.com`

---

## 🖥️ How to Use During Townhall

You have **3 URLs** (replace `your-app` with your actual Render URL):

| Page | URL | Who uses it |
|------|-----|-------------|
| **Participant** | `https://your-app.onrender.com/` | Your 100 employees (share this QR or link) |
| **Big Screen** | `https://your-app.onrender.com/display.html` | Open on the big screen / projector |
| **Control Panel** | `https://your-app.onrender.com/control.html` | You (CJ) on your laptop |

### On the day:
1. Open **display.html** on the big screen (fullscreen it)
2. Open **control.html** on your laptop
3. Share the **participant link** (or a QR code) with employees
4. Use the Control Panel to launch polls or word clouds — results update live!

---

## ⚠️ Important: Render Free Tier

Render's free plan **sleeps after 15 minutes of no traffic**.  
👉 Open your app URL at least **5 minutes before** your session starts to wake it up.

---

## ✅ Features

- **Live Poll** — Multiple choice, real-time bar chart
- **Word Cloud** — Employees type words, cloud builds live on screen
- **Control Panel** — Push questions, stop, reset anytime
- **100+ participant** support
- **No login required** for participants — just open the link

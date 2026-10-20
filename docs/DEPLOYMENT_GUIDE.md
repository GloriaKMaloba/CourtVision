# CourtVision™ - Cloud Deployment & Domain Setup Guide

> **M-PESA x Jr. NBA Kenya Grassroots Talent Identification Platform**  
> *How to deploy CourtVision™ to the public internet with a live URL and PostgreSQL database.*

---

## 🌐 Overview

This guide explains how to take CourtVision™ from your local laptop and host it live on the public internet so that anyone in Kenya or around the world can access it from their smartphone or computer.

---

## 🚀 Option 1: 1-Click Free Deployment via Render (Recommended)

[Render](https://render.com) is a cloud hosting platform that natively supports full-stack web applications, background workers, and managed PostgreSQL databases.

We have already configured a **Render Blueprint (`render.yaml`)** in the root of the repository. This means Render will automatically detect and deploy all three components:
1. **Managed PostgreSQL Database** (`courtvision-postgres`)
2. **Flask Python REST API** (`courtvision-backend`)
3. **React Frontend** (`courtvision-frontend`) with free automatic SSL (`https://`)

---

### Step-by-Step Instructions:

#### Step 1: Create a Render Account
1. Visit **[https://render.com](https://render.com)**.
2. Click **"Get Started for Free"** or **"Sign In"**.
3. Choose **"Sign in with GitHub"** (using your GitHub account `GloriaKMaloba`).

#### Step 2: Launch the Blueprint
1. Once logged into the Render Dashboard, click the **"New +"** button at the top right.
2. Select **"Blueprint"** from the dropdown menu.
3. Choose your repository: **`GloriaKMaloba/CourtVision`** (if not visible, click *Configure account* to grant access to the repo).
4. Select the **`main`** branch.
5. Enter a Blueprint Instance Name (e.g., `courtvision-production`).

#### Step 3: Deploy
1. Render will scan `render.yaml` and display the three services it is about to create:
   - ✅ Managed PostgreSQL Database (`courtvision-postgres`)
   - ✅ Backend Web Service (`courtvision-backend`)
   - ✅ Static Frontend Site (`courtvision-frontend`)
2. Click **"Apply"**.
3. Render will now automatically:
   - Provision the PostgreSQL database.
   - Install Python dependencies and start the Flask API.
   - Build the React frontend with Vite.
   - Link the frontend to the backend and database.

#### Step 4: Your Live URL!
Within 3–5 minutes, your build will show **"Live"**:
- Your live frontend URL will look like:  
  👉 **`https://courtvision-frontend.onrender.com`**
- Your live API URL will look like:  
  👉 **`https://courtvision-backend.onrender.com/api`**

Anyone anywhere in the world can now visit that link, register as an athlete, upload video clips, and receive computer vision feedback!

---

## 🏷️ Option 2: Connecting a Custom Domain (e.g. `courtvision.ke` or `courtvision.com`)

If you want a professional custom domain name for your capstone project rather than `.onrender.com`:

### Step 1: Purchase the Domain Name
1. Purchase a domain from any accredited registrar:
   - For **`.ke`** domains (e.g., `courtvision.ke` or `courtvision.co.ke`): [TrueHost Cloud Kenya](https://truehost.co.ke) or [HostPinnacle Kenya](https://www.hostpinnacle.co.ke) (~1,000 KES/year).
   - For **`.com`** domains (e.g., `courtvision.com`): [Namecheap](https://www.namecheap.com) or [GoDaddy](https://www.godaddy.com) (~$10/year).

### Step 2: Add Custom Domain in Render
1. In your Render Dashboard, click on your **`courtvision-frontend`** service.
2. In the left sidebar, click **"Settings"**.
3. Scroll down to the **"Custom Domains"** section and click **"Add Custom Domain"**.
4. Type your domain (e.g., `courtvision.ke` or `www.courtvision.ke`) and click **"Save"**.

### Step 3: Configure DNS Records
Render will display two DNS records:
- **CNAME Record**: points `www` to `courtvision-frontend.onrender.com`.
- **A Record**: points your root domain to Render's IP address.

1. Open your domain registrar portal (e.g., TrueHost or Namecheap).
2. Go to **DNS Management** for your domain.
3. Add the CNAME and A records provided by Render.
4. Render will automatically issue a free **SSL certificate (HTTPS lock icon)** within 15–30 minutes!

---

## 🐳 Option 3: Self-Hosted Docker Deployment (VPS / Cloud VM)

If deploying to a Virtual Private Server (such as AWS EC2, DigitalOcean Droplet, or Linode):

1. **SSH into your server**:
   ```bash
   ssh root@your-server-ip
   ```
2. **Clone the repository**:
   ```bash
   git clone https://github.com/GloriaKMaloba/CourtVision.git
   cd CourtVision
   ```
3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your production secrets
   nano .env
   ```
4. **Launch all containers**:
   ```bash
   docker compose up -d --build
   ```
5. All three services (Nginx React Frontend on port 80, Flask Backend on port 5000, and PostgreSQL on port 5432) will be up and running permanently in the background.

---

## 🧪 Post-Deployment Verification Checklist

Once your deployment is live:
1. Open the live URL in your phone or browser.
2. Click **"Get Started"** and register a new athlete account.
3. Upload a sample basketball video and verify the progress bar reaches 100%.
4. Check the results page to confirm the **Shooting Angle** and **Jump Height** are extracted and displayed.
5. Log in with the scout demo account and verify the new athlete appears in the **Regional Talent Discovery Grid**!

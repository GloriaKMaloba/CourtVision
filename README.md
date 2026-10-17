# CourtVision™ - Basketball Talent Identification System

> **Grassroots Computer Vision Talent Scouting Platform**  
> Developed for the **M-PESA x Jr. NBA Kenya** program as an Informatics and Computer Science capstone project at Strathmore University.

---

## 📌 Project Overview

CourtVision™ is an automated computer vision platform designed to democratize and standardize basketball talent identification in Kenya. Using smartphone video footage, the system extracts objective shooting performance metrics:
1. **Shooting Angle** (release angle in degrees)
2. **Jump Height at Ball Release** (vertical explosiveness in cm)
3. **Shot Type Classification** (two-point vs. three-point categorization)

---

## 🚀 Milestone 1 Deliverables: Backend & Core Application Setup

Milestone 1 establishes the full-stack architecture, relational database persistence, role-based authentication, and video upload ingestion pipeline:

- **Relational Database & Models**:
  - `User`: Email/password credentials, role-based access (`athlete`, `scout`, `admin`).
  - `AthleteProfile`: County (e.g., Nairobi, Kisumu, Mombasa, Eldoret), school/club, height, position, dominant hand.
  - `ScoutProfile`: Scouting organization (e.g., Jr. NBA, M-PESA Foundation), title, contact info.
  - `Video`: File metadata, original/stored filename, size, pipeline status (`pending`, `processing`, `completed`, `failed`).
  - `VideoProcessingJob`: Asynchronous job tracking for the computer vision pipeline.
  - `ShotAnalysis` & `PerformanceMetric`: Output schema for YOLOv8 & MediaPipe metrics.
  - Support for **PostgreSQL** in production with automatic **SQLite** fallback for local development.

- **Authentication Module (`/api/auth`)**:
  - Password hashing with **bcrypt**.
  - Secure **JWT (JSON Web Token)** authentication middleware.
  - Role-based route decorators (`@jwt_required`, `@role_required`).
  - Pre-seeded demo accounts for quick supervisor testing.

- **Video Ingestion Module (`/api/videos`)**:
  - Multipart video upload (`.mp4`, `.mov`, `.avi`, `.webm`) up to 500MB.
  - Secure storage handling with UUID indexing and sanitization.
  - Automatic creation of video records and queued CV processing jobs.

- **Frontend Integration (React + Vite + Tailwind CSS)**:
  - Global `AuthContext` managing tokens and active session lifecycle.
  - Modernized `Navbar` showing active user status, role badge, and session controls.
  - Interactive `LoginPage` with 1-click demo logins and role-specific registration fields.
  - Fully functional `UploadPage` with drag-and-drop file upload, format validation, and progress tracking.
  - `DashboardPage` displaying athlete profile, session history, and video processing status.

---

## 🛠 Quick Start Guide

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Activate Python virtual environment
# Windows:
venv\Scripts\activate

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Seed the database with demo accounts
python seed.py

# Start the Flask API server (runs on port 5000)
python run.py
```

### 2. Frontend Setup

```bash
# In a new terminal, navigate to frontend directory
cd frontend

# Install packages
npm install

# Start Vite development server (runs on port 5173 with proxy to port 5000)
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 👥 Demo Accounts for Fast Testing

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Athlete** | `athlete@courtvision.ke` | `password123` | Kevin Otieno (Kisumu County, Shooting Guard, 188cm) |
| **Scout** | `scout@courtvision.ke` | `password123` | Coach Achieng (M-PESA x Jr. NBA Regional Scout) |
| **Admin** | `admin@courtvision.ke` | `adminpassword123` | Gloria Maloba (System Administrator) |

---

## 🧪 Running Backend Automated Tests

```bash
# From the project root
$env:PYTHONPATH="backend"
backend\venv\Scripts\python.exe backend\tests\test_api.py
```

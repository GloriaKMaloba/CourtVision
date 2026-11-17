# CourtVision™ REST API Specification

> **Version**: 1.0.0  
> **Base URL**: `http://localhost:5000/api` (Local Dev) / `http://localhost/api` (Docker Nginx)  
> **Authentication Scheme**: Bearer JSON Web Token (JWT) via `Authorization` header

---

## 📌 Overview

CourtVision™ exposes a RESTful API designed to support the **M-PESA x Jr. NBA Kenya** grassroots basketball talent identification platform. It manages user accounts, role-based profiles (Athletes, Scouts, Admins), video ingestion, computer vision processing status, biomechanical performance metrics, and regional scout discovery.

---

## 🔐 Authentication & Authorization

All protected routes require an HTTP header formatted as:
```http
Authorization: Bearer <your_jwt_token>
```

Tokens are valid for 24 hours. The token payload contains:
- `sub`: User ID
- `email`: User email address
- `role`: Role (`athlete`, `scout`, `admin`)
- `exp`: Token expiration timestamp

---

## 1. Authentication Module (`/api/auth`)

### 1.1 User Registration
Creates a new account and associated role profile.

- **URL**: `POST /api/auth/register`
- **Auth Required**: None (Public)
- **Request Body (JSON)**:
```json
{
  "email": "shooter@courtvision.ke",
  "password": "SecurePassword123",
  "full_name": "Kevin Otieno",
  "role": "athlete",
  "county": "Kisumu",
  "position": "Shooting Guard",
  "height_cm": 188.0,
  "school_or_club": "Kisumu Lakers Academy"
}
```
*Note: For `scout` registrations, supply `"organization"` and `"title"` instead of athlete fields.*

- **Responses**:
  - `201 Created`:
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "shooter@courtvision.ke",
    "full_name": "Kevin Otieno",
    "role": "athlete",
    "created_at": "2026-10-20T18:00:00Z",
    "profile": {
      "county": "Kisumu",
      "position": "Shooting Guard",
      "height_cm": 188.0,
      "school_or_club": "Kisumu Lakers Academy"
    }
  }
}
```
  - `400 Bad Request`: Validation error or email already in use.

---

### 1.2 User Login
Authenticates user credentials and issues a JWT token.

- **URL**: `POST /api/auth/login`
- **Auth Required**: None (Public)
- **Request Body (JSON)**:
```json
{
  "email": "athlete@courtvision.ke",
  "password": "password123"
}
```
- **Responses**:
  - `200 OK`:
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "athlete@courtvision.ke",
    "full_name": "Kevin Otieno",
    "role": "athlete"
  }
}
```
  - `401 Unauthorized`: Invalid credentials.

---

### 1.3 Active User Profile (`/me`)
Returns the currently authenticated user's details and profile.

- **URL**: `GET /api/auth/me`
- **Auth Required**: Bearer Token
- **Responses**:
  - `200 OK`: Returns current user object with profile.
  - `401 Unauthorized`: Missing or invalid token.

---

## 2. Video Ingestion & Processing Module (`/api/videos`)

### 2.1 Multipart Video Upload
Uploads a smartphone drill video and queues asynchronous CV processing.

- **URL**: `POST /api/videos/upload`
- **Auth Required**: Bearer Token (`athlete` or `admin`)
- **Content-Type**: `multipart/form-data`
- **Form Data**:
  - `video` (File, required): `.mp4`, `.mov`, `.avi`, `.webm`, or `.mkv` file (max 500MB).
  - `title` (String, optional): Title of the drill (e.g., "Free Throw Routine").
  - `notes` (String, optional): Additional drill notes.
- **Responses**:
  - `201 Created`:
```json
{
  "message": "Video uploaded successfully and queued for processing",
  "video": {
    "id": 4,
    "title": "Kisumu Drill Session",
    "original_filename": "drill1.mp4",
    "stored_filename": "d3b07384_drill1.mp4",
    "status": "pending",
    "file_size_bytes": 10485760,
    "created_at": "2026-10-20T18:30:00Z"
  }
}
```
  - `400 Bad Request`: Disallowed extension or missing `video` field.

---

### 2.2 List User Videos
Returns all videos uploaded by the authenticated user (or all videos if requested by scout/admin).

- **URL**: `GET /api/videos`
- **Auth Required**: Bearer Token
- **Responses**:
  - `200 OK`: Array of video metadata records with duration and shot summaries.

---

### 2.3 Check Video Processing Status
Polls the active stage of the computer vision background worker.

- **URL**: `GET /api/videos/<video_id>/status`
- **Auth Required**: Bearer Token
- **Responses**:
  - `200 OK`:
```json
{
  "video_id": 4,
  "status": "completed",
  "job": {
    "stage": "done",
    "progress_percent": 100,
    "error_message": null,
    "started_at": "2026-10-20T18:30:01Z",
    "completed_at": "2026-10-20T18:30:05Z"
  }
}
```

---

### 2.4 Video Biomechanical Results
Fetches individual shot frames and extracted metrics for a completed video.

- **URL**: `GET /api/videos/<video_id>/results`
- **Auth Required**: Bearer Token
- **Responses**:
  - `200 OK`:
```json
{
  "video": {
    "id": 4,
    "title": "Midrange Drill",
    "status": "completed",
    "summary": {
      "total_shots": 3,
      "two_pointers": 3,
      "three_pointers": 0,
      "avg_shooting_angle": 128.4,
      "avg_jump_height": 45.2,
      "max_jump_height": 48.0
    }
  },
  "shots": [
    {
      "shot_index": 1,
      "timestamp_release": 2.4,
      "shot_type": "two_point",
      "classification_confidence": 0.94,
      "metric": {
        "shooting_angle_deg": 127.8,
        "jump_height_cm": 44.5,
        "release_time_sec": 0.45
      }
    }
  ]
}
```

---

### 2.5 Stream / Download Video
Streams the raw video file using partial HTTP byte-ranges.

- **URL**: `GET /api/videos/<video_id>/stream`
- **Auth Required**: Bearer Token (or `?token=<jwt>` query parameter for HTML5 `<video>` tags).
- **Responses**:
  - `206 Partial Content` / `200 OK`: Video stream.

---

### 2.6 Delete Video
Permanently removes a video file and its associated shot metrics.

- **URL**: `DELETE /api/videos/<video_id>`
- **Auth Required**: Bearer Token (Uploader or Admin)
- **Responses**:
  - `200 OK`: `{"message": "Video deleted successfully"}`

---

## 3. Athlete Analytics Module (`/api/athletes` & `/api/athlete`)

### 3.1 Athlete Progression & Consistency Portfolio
Aggregates performance history, consistency ratings, and timeline progression.

- **URL**: `GET /api/athletes/me/metrics` *(or `/api/athlete/me/metrics`)*
- **Auth Required**: Bearer Token (`athlete`)
- **Responses**:
  - `200 OK`:
```json
{
  "metrics": {
    "total_sessions": 4,
    "total_shots": 12,
    "two_pointers": 8,
    "three_pointers": 4,
    "two_point_pct": 66.7,
    "three_point_pct": 33.3,
    "shooting_angle": {
      "mean": 128.5,
      "std": 2.1,
      "min": 125.0,
      "max": 132.0,
      "consistency_rating": "Elite Consistency"
    },
    "jump_height_cm": {
      "mean": 46.8,
      "std": 3.4,
      "min": 41.0,
      "max": 53.0
    },
    "timeline": [
      {
        "video_id": 4,
        "title": "Drill 1",
        "shot_count": 3,
        "avg_shooting_angle": 128.4,
        "avg_jump_height": 45.2,
        "max_jump_height": 48.0
      }
    ]
  }
}
```

---

## 4. Scout Talent Portal (`/api/scout` & `/api/scouts`)

### 4.1 Talent Discovery Grid
Enables scouts to discover, search, and evaluate athletes across Kenya.

- **URL**: `GET /api/scout/athletes`
- **Auth Required**: Bearer Token (`scout` or `admin`)
- **Query Parameters**:
  - `county` (String, optional): Filter by county (e.g., `Nairobi`, `Kisumu`, `Mombasa`, `Eldoret`).
  - `position` (String, optional): Filter by playing position.
  - `min_shots` (Integer, optional): Minimum shot count threshold.
  - `sort_by` (String, optional): `recent`, `jump`, `angle`, `shots`.
- **Responses**:
  - `200 OK`:
```json
{
  "total": 1,
  "athletes": [
    {
      "id": 1,
      "full_name": "Victor Omondi",
      "email": "omondi@courtvision.ke",
      "profile": {
        "county": "Kisumu",
        "position": "Shooting Guard",
        "height_cm": 194.0,
        "school_or_club": "Lakers Academy"
      },
      "performance": {
        "total_shots": 15,
        "total_videos": 5,
        "avg_shooting_angle": 129.2,
        "max_jump_height": 55.0,
        "two_pointers": 10,
        "three_pointers": 5,
        "three_point_pct": 33.3
      }
    }
  ]
}
```

---

### 4.2 Athlete Deep Profile
Retrieves an athlete's comprehensive profile including all recorded video drills.

- **URL**: `GET /api/scout/athletes/<athlete_id>`
- **Auth Required**: Bearer Token (`scout` or `admin`)
- **Responses**:
  - `200 OK`: Returns detailed profile and list of video drill sessions.

---

## 5. System Administration Module (`/api/admin`)

### 5.1 System KPI Statistics
Provides platform-level metrics across all users, videos, and computer vision jobs.

- **URL**: `GET /api/admin/stats`
- **Auth Required**: Bearer Token (`admin` only)
- **Responses**:
  - `200 OK`:
```json
{
  "users": {
    "total": 45,
    "athletes": 38,
    "scouts": 5,
    "admins": 2
  },
  "videos": {
    "total": 120,
    "completed": 115,
    "processing": 2,
    "failed": 3,
    "pending": 0
  },
  "shots": {
    "total": 450,
    "avg_shooting_angle": 128.1,
    "max_jump_height": 62.5
  }
}
```

---

### 5.2 User Directory & Governance
Lists all system accounts with search and filtering.

- **URL**: `GET /api/admin/users?role=athlete&search=kevin`
- **Auth Required**: Bearer Token (`admin` only)
- **Responses**:
  - `200 OK`: Array of user accounts with profile metadata and video upload counts.

---

### 5.3 Delete User Account
Removes a user account and cascades deletion to profiles, videos, and metrics.

- **URL**: `DELETE /api/admin/users/<user_id>`
- **Auth Required**: Bearer Token (`admin` only)
- **Responses**:
  - `200 OK`: `{"message": "User 'John Doe' and all associated records have been deleted."}`
  - `400 Bad Request`: Cannot delete own admin account.

---

## 6. System Health Check (`/api/health`)

- **URL**: `GET /api/health`
- **Auth Required**: None (Public)
- **Responses**:
  - `200 OK`:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "service": "CourtVision API",
  "database": "connected"
}
```

# CourtVision™ - User Walkthrough Guide & Standard Operating Procedures

> **M-PESA x Jr. NBA Kenya Grassroots Talent Identification Platform**  
> *Strathmore University Informatics & Computer Science Capstone*  
> **Author**: Gloria Khalayi Maloba (168878) • **Supervisor**: Kelvin Ouma

---

## 📖 About This Guide

CourtVision™ is an automated computer vision talent scouting system that allows grassroots basketball athletes across Kenya to be objectively evaluated using only ordinary smartphone video footage.

This guide provides step-by-step instructions for:
1. **Athletes & Coaches**: How to record compliant footage, upload clips, and interpret extracted biomechanical shooting metrics.
2. **Talent Scouts**: How to search, filter, and evaluate athletes across Kenyan counties.
3. **Administrators**: How to inspect system health and manage user accounts.

---

## 📹 Part 1: Smartphone Filming Best Practices (Recording SOP)

To ensure the computer vision pipeline (YOLOv8 & MediaPipe Pose) achieves maximum landmark tracking accuracy, follow these camera recording standards:

```
                      +-------------------+
                      |   Basketball Rim  |
                      +-------------------+
                               |
                               |  Shooting Trajectory
                               v
                       [ Athlete / Shooter ]
                               ^
                               |
                               | (15 – 20 feet)
                               | Side Profile Angle (90°)
                               v
                        [ Smartphone Camera ]
                        (Height: 1.2m – 1.4m)
```

### 1. Camera Angle & Placement
- **Perpendicular Side Profile (90°)**: Position the camera directly to the shooting-hand side of the athlete (e.g., right side for right-handed shooters). This provides the clearest visibility of the elbow angle, knee bend, and release point.
- **Distance**: Place the camera **15 to 20 feet (4.5m – 6m)** away so the athlete’s full body (from feet to above the ball release point) remains fully in frame throughout the entire jump.
- **Elevation**: Mount the phone on a tripod or hold it at **chest height (approx. 1.2m to 1.4m)**. Avoid extreme low-angle or high-angle perspectives.

### 2. Lighting & Clothing
- **Lighting**: Film in well-lit conditions (outdoor daylight or well-illuminated indoor gymnasiums). Avoid strong backlighting (e.g., pointing the camera directly into the setting sun).
- **Attire**: Standard athletic shorts and jersey. Avoid oversized, baggy clothing that obscures the knees, hips, or elbows.

### 3. Video Specifications
- **Resolution**: 1080p (Full HD) or 720p.
- **Frame Rate**: Standard **30 FPS** or **60 FPS**.
- **Duration**: Short clips containing **1 to 5 continuous shot repetitions** (10 to 60 seconds).
- **Supported Formats**: `.mp4`, `.mov`, `.avi`, `.webm`.

---

## 🏀 Part 2: Athlete & Coach Portal Walkthrough

### Step 1: Account Creation & Profile Setup
1. Open the CourtVision™ web application (`http://localhost:5173` or deployed URL).
2. Click **"Get Started"** or **"Sign Up"**.
3. Select **Role: Athlete**.
4. Fill in your basketball demographic profile:
   - **Full Name** & **Email**
   - **County**: (e.g., *Nairobi*, *Kisumu*, *Mombasa*, *Eldoret*, *Kiambu*, *Nakuru*)
   - **Primary Position**: (*Point Guard*, *Shooting Guard*, *Small Forward*, *Power Forward*, *Center*)
   - **Height (cm)**: Crucial for scaling pixel displacement to real-world centimeters.
   - **School or Club**: (e.g., *Lakers Basketball Academy*, *Strathmore High*)
5. Click **Create Athlete Account**.

---

### Step 2: Uploading Drill Footage
1. Navigate to the **"Upload"** tab in the navigation bar.
2. Drag and drop your recorded `.mp4` or `.mov` clip into the upload box (or click to browse).
3. Enter a descriptive title (e.g., *"Kisumu Clinic - 3-Point Drill"*).
4. Click **"Upload & Run Computer Vision Analysis"**.
5. The live progress bar will track your upload. Once uploaded, the video enters the background queue (`detecting_ball` $\to$ `tracking_pose` $\to$ `extracting_metrics` $\to$ `done`).

---

### Step 3: Interpreting Your Biomechanical Metrics

Once processing completes, open your **Dashboard** or click **"View Analytics"** to review your extracted performance:

#### 1. Shooting Release Angle (Elbow Extension)
- **What it measures**: The angle formed by the **Shoulder $\to$ Elbow $\to$ Wrist** at the exact millisecond the basketball leaves the fingertips.
- **Elite Benchmark**: **$125^\circ \text{ to } 140^\circ$**. 
  - An angle below $115^\circ$ indicates a "flat" or premature push.
  - An angle above $150^\circ$ indicates an over-extended release.

#### 2. Jump Height at Ball Release
- **What it measures**: The vertical elevation of the athlete's hips and ankles off the floor at the peak release window, scaled using the athlete's registered physical height.
- **Why it matters to scouts**: Measures vertical explosiveness, jump consistency, and the ability to release over closing defenders.

#### 3. Shot Type Classification (XGBoost)
- The system automatically categorizes each shot attempt as a **Two-Point** or **Three-Point** shot based on body posture dynamics (knee dip depth, trunk lean, and wrist rise velocity).
- Your dashboard displays your **Shot Distribution Ratio** (e.g., *60% 2pt / 40% 3pt*).

#### 4. Shooting Consistency Rating Badges
CourtVision calculates the sample standard deviation ($\sigma$) of your release angle across drills:
- 🟢 **Elite Consistency** ($\sigma \le 2.5^\circ$): NBA/national team grade muscle memory.
- 🔵 **High Consistency** ($2.5^\circ < \sigma \le 4.0^\circ$): Advanced varsity/academy shooter.
- 🟡 **Moderate Consistency** ($4.0^\circ < \sigma \le 6.0^\circ$): Developing shooter with good mechanics.
- 🟠 **Developing Consistency** ($\sigma > 6.0^\circ$): Mechanics require form refinement.

#### 5. Historical Progression Chart
Toggle between **Jump Height** and **Shooting Angle** to see how your mechanics develop drill-by-drill over weeks of training.

---

## 🔍 Part 3: Scout Talent Portal Walkthrough

The Scout Portal is built specifically for **M-PESA x Jr. NBA Regional Scouts** and coaches to discover talent beyond major urban hubs.

### Step 1: Scout Sign In
1. Log in with your verified Scout account (or test with demo credentials: `scout@courtvision.ke` / `password123`).
2. You will be routed directly to the **Regional Talent Discovery Portal**.

### Step 2: Regional Discovery & Filtering
- **County Filter**: Narrow down athletes by region (*Nairobi*, *Kisumu*, *Mombasa*, *Eldoret*, etc.).
- **Position Filter**: Filter for specific roster needs (e.g., *Shooting Guard* or *Point Guard*).
- **Search Bar**: Search athletes by name or school/academy.

### Step 3: Evaluating an Athlete
1. Each athlete card in the grid displays their:
   - High school / club affiliation
   - Verified physical height
   - Total recorded shots & drills
   - Average release angle and peak vertical jump
2. Click **"View Scouting Profile →"** to open the deep athlete modal:
   - Review all uploaded drill videos.
   - Inspect individual shot-by-shot biomechanical breakdowns.
   - Play back original footage with synchronized shot timestamps.

---

## ⚙️ Part 4: System Administration Walkthrough

Administrators have oversight of platform adoption and pipeline health:
1. Log in with admin credentials (`admin@courtvision.ke` / `adminpassword123`).
2. Navigate to `/dashboard` to access the **Admin Console**.
3. **KPI Metrics Cards**:
   - Total registered athletes and scouts.
   - Total video files stored and server storage usage.
   - Computer vision completed vs. failed jobs.
   - Aggregate shots identified across Kenya.
4. **User Governance Table**:
   - Filter and search users by role (`athlete`, `scout`, `admin`).
   - Audit registration timestamps and profile metadata.
   - Remove fraudulent or inactive accounts using the **"Delete User"** button.

---

## ❓ Frequently Asked Questions (FAQ)

### Q1: What happens if a video has no shots?
The computer vision pipeline will complete cleanly, reporting 0 detected shots. The athlete's historical averages will not be corrupted, and a note will indicate no shots were identified in the frame.

### Q2: Can coaches upload videos on behalf of their players?
Yes. Coaches can either create an Athlete profile for their player or upload clips under the athlete's account.

### Q3: Why does my jump height say 0 cm?
If the athlete performs a set shot without leaving their feet (common in free throws), vertical jump displacement is correctly measured as 0 cm.

### Q4: Which smartphone models are supported?
Any standard smartphone running iOS or Android capable of recording 720p or 1080p video at 30 frames per second. No external sensors, wearables, or specialized hardware are required.

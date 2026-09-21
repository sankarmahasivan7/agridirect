# 🎬 AgriDirect 90-Second Promotional Video (Remotion + React)

A code-driven promotional video production pipeline built for **AgriDirect** using **Remotion & React**. Combines real website screen recordings and snapshots with smooth camera pans, UI spotlights, animated typography, and direct transaction flow diagrams.

---

## ⏱️ Video Structure (90 Seconds / 2,700 Frames @ 30 FPS)

| Scene | Duration | Description |
| :--- | :--- | :--- |
| **1. Hook** | 0–8 sec (0–240 f) | Lush agrarian background + animated question: *"What if farmers could sell directly to buyers?"* |
| **2. Problem** | 8–18 sec (240–540 f) | The 4 pain points: 30–40% Middleman cuts, Opaque mandi rates, Limited market access, Delayed cash. |
| **3. Introducing AgriDirect** | 18–30 sec (540–900 f) | 3D browser laptop mockup with real homepage, live APMC mandi ticker, and zero brokerage guarantee. |
| **4. Farmer Workflow** | 30–45 sec (900–1350 f) | Real Farmer UI: Produce listing, harvest quality grading, direct price setting (+₹4/kg), instant publish. |
| **5. Buyer Workflow** | 45–58 sec (1350–1740 f) | Real Buyer UI: Farm-origin catalog, transparent price breakdown, 1-click checkout (UPI QR / Cash). |
| **6. Direct Connection** | 58–68 sec (1740–2040 f) | Split screen: `FARMER` &larr;── `AgriDirect Core` ──&rarr; `BUYER` with animated digital settlement beams. |
| **7. Smart Agriculture** | 68–78 sec (2040–2340 f) | Real Agmarknet mandi rates (Tenkasi, Tirunelveli, Thoothukudi), AI demand forecasting & GPS route tracking. |
| **8. Closing & CTA** | 78–90 sec (2340–2700 f) | Brand reveal: *"AgriDirect — Connecting Farmers Directly to Markets"*, live URL `agridirect-1-epvz.onrender.com`. |

---

## 🚀 How to Run & Preview

### 1. Interactive Real-Time Preview (Recommended)
Launch the Remotion Studio in your browser:
```bash
cd video
npm run preview
```
Open **`http://localhost:3000`** in your browser to scrub through all 90 seconds, inspect frames, and play the video in real time.

### 2. Render Full 1080p MP4 Video
To render the complete high-definition video:
```bash
cd video
npm run render
```
The output file will be saved to **`video/out/agridirect_promo.mp4`**.

### 3. Re-capture Website Screenshots
To refresh the real website screenshots from the live or local site:
```bash
cd video
npm run capture
```

---

## 📁 Project Architecture

- **`src/AgriDirectPromo.tsx`**: Master sequence orchestrating all 8 scenes with frame-accurate timing.
- **`src/components/BrowserFrame.tsx`**: Realistic browser & laptop mockup with dynamic pan, zoom, and tilt.
- **`src/components/SpotlightCallout.tsx`**: Animated cursor pointer with click ripple and glowing spotlight.
- **`src/components/ParticleBackground.tsx`**: Agricultural ambient particle field with golden and emerald themes.
- **`src/scenes/`**: Individual scene components (Scene 1 through Scene 8).
- **`public/assets/`**: Real high-resolution screen captures from the live AgriDirect application.


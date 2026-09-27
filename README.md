# Repwise

### Local-first workout tracking, built for consistency.

Repwise is a **mobile-first Progressive Web App (PWA)** for creating workout routines, logging workouts, tracking personal records, and monitoring progress.

It is built with a **local-first architecture**, so workout data is stored directly on the device and the app works offline. Optional Google Drive backup keeps your data recoverable without requiring a backend.

<p align="center">
  <img src="public/logo.png" alt="Repwise Logo" width="120" />
</p>

---

## ✨ Features

* 🏋️ **Workout Routines** — Create and manage reusable workout routines.
* 📝 **Workout Logging** — Track sets, reps, weight, and completed exercises.
* 👻 **Previous Performance** — See your previous workout while logging a new one.
* 🏆 **Personal Records** — Track your all-time best performance for each exercise.
* 📈 **Progress Tracking** — Monitor strength, volume, and estimated 1RM.
* 🔥 **Workout Streaks** — Track consistency and workout frequency.
* ⚖️ **Body Weight** — Record and visualize weight changes over time.
* ⏱️ **Rest Timer** — Built-in rest timer with audio and vibration support.
* 📴 **Offline First** — Continue using the app without an internet connection.
* 💾 **Local Storage** — Workout data is stored locally using IndexedDB.
* ☁️ **Google Drive Backup** — Optional backup and restore.
* 📦 **JSON Export & Import** — Keep a portable copy of your data.

---

## 🛠️ Tech Stack

| Technology           | Purpose                          |
| -------------------- | -------------------------------- |
| **Next.js**          | Application framework            |
| **TypeScript**       | Type-safe development            |
| **Tailwind CSS**     | UI styling                       |
| **Dexie.js**         | IndexedDB database               |
| **IndexedDB**        | Local data storage               |
| **Recharts**         | Progress charts                  |
| **Lucide React**     | Icons                            |
| **Google Drive API** | Optional backup                  |
| **PWA**              | Installable & offline experience |

---

## 🏗️ Architecture

Repwise follows a simple **local-first architecture**:

```text
              Repwise PWA
                   │
          Next.js + React
                   │
               Dexie.js
                   │
               IndexedDB
                   │
          ┌────────┴────────┐
          │                 │
      Local Data        Backup
          │                 │
          │          ┌──────┴──────┐
          │          │             │
          │       JSON File   Google Drive
          │
          ▼
      User Device
```

**IndexedDB is the primary source of truth.**

The application does not require a backend for normal usage.

---

## 📂 Project Structure

```text
repwise/
├── public/
│   ├── favicon.ico
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── logo.png
│   └── manifest.json
│
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   ├── workouts/
│   │   ├── progress/
│   │   └── settings/
│   │
│   ├── components/
│   ├── db/
│   ├── hooks/
│   ├── lib/
│   └── types/
│
├── next.config.mjs
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 🚀 Getting Started

### Prerequisites

* Node.js 18.17+
* npm or pnpm
* Git

### Installation

```bash
git clone https://github.com/<your-username>/repwise.git
cd repwise
npm install
```

### Development

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## ☁️ Google Drive Backup

Google Drive backup is optional.

Create a `.env.local` file:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

To enable backup:

1. Create a Google Cloud project.
2. Enable the Google Drive API.
3. Create an OAuth 2.0 Web Client.
4. Add your development and production URLs as authorized origins.
5. Use the `drive.appdata` scope.

The application remains fully functional without Google Drive.

---

## 📱 PWA

Repwise can be installed on supported devices as a Progressive Web App.

For production PWA testing:

```bash
npm run build
npm run start
```

Then open the application in a supported browser and install it from the browser's install option.

---

## 🔐 Data & Privacy

Repwise is designed around **data ownership**.

* No account is required for normal usage.
* Workout data is stored locally.
* The app works offline.
* Google Drive backup is optional.
* Data can be exported as JSON.
* No backend is required for the core application.

---

## 🗺️ Roadmap

* [x] Workout routines
* [x] Workout logging
* [x] Workout history
* [x] Personal records
* [x] Progress tracking
* [x] Body weight tracking
* [x] Workout streaks
* [x] Rest timer
* [x] Offline support
* [x] PWA support
* [x] JSON export/import
* [x] Google Drive backup
* [ ] Progressive overload suggestions
* [ ] Health Connect integration

---

## 📄 License

This project is licensed under the MIT License.

See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Repwise — Train. Track. Progress.</strong>
</p>

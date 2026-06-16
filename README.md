# 🌌 Aura Finance

A simple, cozy, and collaborative budget tracker made for friends and family. This app is completely free, non-commercial, and was vibecoded with human supervision.

---

## Features

- **Collaborative Sync**: Connect with friends or family via a shared group using Firebase.
- **Visual Calendar**: A day-to-day log displaying spending and income in calendar cells.
- **Daily Quotas & Carryover**: Calculates how much you can spend today based on your month's budget, roll-over savings, or overspent limits.
- **Simple Streaks**: Visual trackers to keep on top of personal targets (e.g. "No Overspending", "No Takeout", or "Saving").
- **Linked Debts**: Log what you borrow or lend. Link to another group ID to sync and settle bidirectionally.
- **Subscriptions**: Input recurring bills so they automatically record when a new period begins.
- **Grocery Checklist**: A shared list for keeping track of shopping trips in real-time.
- **Themes**: Switch between light and dark modes, or pick a custom theme color.

---

## How to Self Host

Since Aura Finance is a static web page, you can host it anywhere.

### 1. Set Up Firebase

1. Create a project on the [Firebase Console](https://console.firebase.google.com/).
2. Start a **Realtime Database** instance.
3. Configure your Database Rules (e.g. read/write allowed so group password checks work):
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
4. Insert your Firebase credentials into `src/js/db.ts`:
   ```typescript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT",
     storageBucket: "YOUR_PROJECT.firebasestorage.app",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID",
     databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com/"
   };
   ```

### 2. Build and Run Locally

1. Install development dependencies:
   ```bash
   npm install
   ```
2. Build the TypeScript modules:
   ```bash
   npm run build
   ```
3. Start a local server:
   ```bash
   python3 -m http.server 8080
   ```
4. Visit `http://localhost:8080` in your web browser.

---

## License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**. 

This is a copyleft license: you are free to modify, host, and share it, but any modified versions or derivative projects must also be released under this same open-source GPL-3.0 license. Refer to the [LICENSE](./LICENSE) file for the full text.

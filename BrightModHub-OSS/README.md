# BrightModHub

BrightModHub is a local dashboard for monitoring Twitch chats, detecting bots, and identifying suspicious activities. This version is specifically optimized for local use, runs via `localhost`, and uses an integrated SQLite database. No external services like ngrok are required.

## 🛠 Prerequisites

- **Node.js**: You need Node.js to run the server. [Download and install Node.js here](https://nodejs.org/).

## 🚀 Setup and Start

The setup is very simple and largely automated:

1. **Configure Environment Variables:**
   Copy the `.env.example` file and rename it to `.env`. You can adjust the default ports (3000) or your default Twitch channel there.

2. **Start the Server:**
   Simply double-click the **`BrightModHub.bat`** file.

**What does the .bat file do?**
- It checks if Node.js is installed.
- If dependencies (`node_modules`) are missing, it automatically installs them via `npm install`.
- It starts the development server.
- The dashboard will then be accessible at the following address:
  **👉 http://localhost:3000**

## 📦 Start Production Build (Optional)

If you want to run the dashboard permanently and with optimal performance (Production Mode), you can compile the application:

1. Open the Command Prompt (CMD) in the folder where this project is located.
2. Run the batch file with the production flag:
   ```cmd
   BrightModHub.bat --prod
   ```
The script will automatically compile the application (if not already done) and start the optimized server, which will again be accessible at `http://localhost:3000`.

## 🗄 Database

This project uses **SQLite** (via `better-sqlite3`) as its local SQL database. All data (detection history, settings, etc.) is automatically stored in the `data` folder. 
You do not need a separate SQL server (like MySQL or PostgreSQL) – everything works "out of the box"!

## 🤝 For Developers (Modders)

If you want to make changes to the code:
- **Frontend/Backend:** Next.js, React, TailwindCSS
- **Database Logic:** The database is initialized in the `data` folder.
- **Server:** The custom server is located in `src/server.ts`.

You can also start the dev server manually in the terminal with:
```bash
npm install
npm run dev
```

Have fun using and modding BrightModHub!

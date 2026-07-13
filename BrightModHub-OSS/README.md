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

## 🛡️ The Detection System Explained

BrightModHub features a highly advanced, multi-dimensional detection engine. Instead of relying on simple word blacklists, it analyzes behavioral patterns over time to reliably distinguish humans from sophisticated bots.

The engine consists of several independent detectors:

### 1. Metronome Detector ⏱️
Analyzes the exact timing between a user's messages. Bots often run on loops (e.g., exactly every 60 seconds). The metronome calculates the standard deviation and periodicity of message intervals to catch perfectly timed, unnatural behavior.

### 2. Pattern & Mash Detector 🧩
Identifies repetitive phrasing, keyboard mashing (e.g., "asdfghjkl"), and obfuscation techniques (like hidden zero-width characters). It calculates similarity ratios between recent messages to stop users who repeatedly post identical or slightly modified text.

### 3. Typing Dynamics ⌨️
Calculates the physical typing speed (characters per second) based on message length and time between messages. It flags users who consistently achieve physically impossible typing speeds that only a script could execute.

### 4. Social & Communicative Analysis 💬
Real humans interact with others. This module tracks reply ratios, unique recipients, and conversational chains. It classifies users into communicative ranks (e.g., "socialite", "talkative") and grants positive Karma to users who actively engage in organic conversations, protecting them from false positives.

### 5. Context & Wave Detector 🌊
Monitors the chat for sudden hype waves. It tracks reaction times to ensure that someone participating in a chat wave didn't react faster than humanly possible (e.g., posting a reaction 50ms after an event). 

### 6. Command Spam 🤖
Monitors the usage ratio of bot commands (messages starting with `!`, like `!drop` or `!join`). It penalizes accounts that exclusively exist to farm commands without ever participating in normal chat.

### 7. Copy-Paste Detector 📋
Detects global copy-paste waves across the entire chat. If an identical message is suddenly spammed by dozens of different accounts simultaneously, it flags the participating accounts as part of a coordinated bot swarm.

### 8. Entropy Detector 🎲
Measures the cryptographic randomness (entropy) of characters in a message. This is highly effective at catching bots that spam random alphanumeric strings (e.g., "a7x9b2P") to bypass simple duplicate-message filters.

### 9. No-Lifer Flag 🧟
Monitors sustained activity over extremely long periods. If an account chats continuously for hours with high intensity and no breaks, it gets flagged as a potential unattended script.

### 📊 Scoring System (Bot Score & Karma)
All detectors feed their findings into the central **Scoring System**:

- **Bot Score**: Increases when suspicious behavior is detected. Thresholds categorize users as:
  - **Clean**: 0 - 100 points
  - **Suspicious**: >100 points
  - **Likely Bot**: >300 points
  - **Confirmed Bot**: >700 points

- **Karma Score (Reputation)**: Karma is the trust system of BrightModHub. It is designed so that **negative Karma is good** (trusted) and **positive Karma is bad** (flagged).
  - **Trusted (<= -50 Karma)**: Users who demonstrate organic human behavior, have subscriptions, or show a long-term healthy chat history. Being "Trusted" protects users from accidental bot flags during hype waves.
  - **Neutral (-49 to 49 Karma)**: Standard users who haven't shown enough behavior to be categorized.
  - **Flagged (>= 50 Karma)**: Users who show mildly suspicious, toxic, or spammy behavior but aren't strictly classified as bots yet.

> [!IMPORTANT]
> **Data Collection Time**
> The Karma system requires historical data to function accurately. When you first start monitoring a channel, everyone starts at 0 Karma (Neutral). You must let the system run for a while (ideally days or weeks) so it can observe chatters over multiple sessions. As regular viewers naturally interact, they will gradually build up negative (Trusted) Karma, creating a robust baseline that makes the detection of real bots much more accurate and eliminates false positives!

## 🗄 Database

This project uses **SQLite** (via `better-sqlite3`) as its local SQL database. All data (detection history, user scores, settings, etc.) is automatically stored persistently in the `data` folder. Ranks and scores are retained even after the application restarts!
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

# Indian Student Association Italy – Padova — Web Application

One project, one command, no accounts or API keys needed. Zero npm dependencies.

## Run it (2 minutes)
1. Install **Node.js 18 or newer** (nodejs.org → LTS).
2. Unzip this folder, then:
   - **Windows:** double-click `start-windows.bat` (opens Google Chrome automatically)
   - **Mac / Linux:** double-click `start-mac-linux.command` (opens Chrome; or run `node server.js` and open http://localhost:3000 in Chrome)
3. The browser opens **http://localhost:3000**. Admin: **/admin** → user `admin`, password `insit1947@2026`.
4. On first start a **16-character security code** is printed in the console and saved in `data/SECURITY-CODE.txt`. Store it safely and delete the file. Needed to change the admin password. New code any time: `npm run newcode`.

**Change the default admin password immediately** (Admin → Password).

## What's inside
| Page | URL |
|---|---|
| Opening page (Indian → Italian flag) + links to all pages | `/` |
| Home: culture, About Us, UniPD link-up, WhatsApp group | `/home` |
| CGI Milan events (year filter, search) | `/events` |
| First-week guide with progress tracker | `/first-week` |
| Questura, University, ESU, Poste, permesso-kit video | `/places` |
| Ambassador & Consul General | `/missions` |
| Student enrolment form (shows +39 3508859406 / isai.padova@gmail.com after submit) | `/enroll` |
| Admin panel | `/admin` |

Admin panel: student list with search/filter/sort/stats, edit, delete, CSV export · activity log · Drive sync · password change (needs the 16-char code) · admin + up to 2 extra users (view-only, add/remove by admin).

## Data & Google Drive sync
- Database: `data/db.json` (back this folder up).
- After every enrolment/edit/delete, and daily, the app writes an **Excel file** and **JSON backups** to the sync folder (`data/drive-sync` by default).
- **To sync with Google Drive:** install *Google Drive for desktop*, then set `DRIVE_DIR` in `.env` to a folder inside it (see `.env.example`). Drive uploads the files automatically.
- Admin → Drive sync shows the folder and files, lets you "Sync now" and download the Excel/backup.

## Login-alert e-mails
Every login, failed attempt, wrong security code, password change and user change is written to `data/mail-outbox.log`. To also receive them at isai.padova@gmail.com: create a Gmail **App password** (myaccount.google.com/apppasswords, needs 2-step verification) and set `SMTP_USER` / `SMTP_PASS` in `.env`. The alert shows time, IP, browser, platform, screen, language/timezone (no location lookup). Passwords and the security code are never e-mailed or logged.

## Put it online
This is a Node server with a file database, so host it where files persist: Render / Railway / Fly.io (with a persistent disk on `/app/data`), a VPS, or Docker (`Dockerfile` included). Set `TRUST_PROXY=1`, and serve over HTTPS (hosting platforms do this for you). It will not work on Vercel/Netlify serverless.

## Security built in
scrypt password hashing · signed 6-hour sessions that die on password change · lockout after 5 wrong passwords (per user and IP) · input validation · honeypot + rate limits · same-origin API check · strict CSP, X-Frame-Options, nosniff, HSTS over HTTPS · path-traversal protection. No system is unhackable: use HTTPS, keep the server updated, back up `data/`, and keep the security code private.

## Tests
`npm test` runs 31 automated API/security checks (including Excel creation and SMTP delivery against a mock mail server).

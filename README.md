# WhatsApp Bot (prefix `.`)

Runs on a separate WhatsApp number, linked with a pairing code (no QR).
The bot only reacts to messages that start with `.` and ignores everything else.

## ON / OFF switch

| Command | Who | What it does |
|---|---|---|
| `.off` | owner | Bot goes silent. It ignores every command except `.on` |
| `.on` | owner | Bot is active again |
| `.status` | anyone | Shows ON/OFF and uptime |

The ON/OFF state is saved in `state.json`, so it survives restarts.
"Owner" = the number you set in `OWNER_NUMBER` (your personal number), or the bot number itself.

## Commands

| Category | Commands |
|---|---|
| General | `.menu` `.help` `.on` `.off` `.status` `.ping` `.alive` `.runtime` `.owner` `.time` `.myid` |
| Fun | `.joke` `.quote` `.fact` `.flip` `.dice` `.8ball` `.calc` |
| Media | `.sticker` (reply to an image/video) |
| Group | `.tagall` `.hidetag` `.kick` `.add` `.promote` `.demote` `.link` `.groupinfo` `.mute` `.unmute` |

## Settings (environment variables)

| Variable | Meaning | Example |
|---|---|---|
| `PHONE_NUMBER` | The separate number the bot will run on (country code, digits only) | `2348011111111` |
| `OWNER_NUMBER` | YOUR personal number, allowed to use `.on` / `.off` / admin commands | `2348022222222` |
| `BOT_NAME` | Name shown in the menu | `MyBot` |
| `PREFIX` | Command prefix (default `.`) | `.` |

## Option A (recommended free): run on an Android phone with Termux

Best if you have a spare Android phone that can stay plugged in and online.

1. Install **Termux from F-Droid** (the Play Store version is outdated).
2. Open Termux and run:
   ```bash
   pkg update -y && pkg upgrade -y
   pkg install -y nodejs-lts git ffmpeg
   termux-setup-storage
   mkdir -p ~/bot
   ```
3. Put `index.js` and `package.json` in the phone's Downloads folder, then:
   ```bash
   cp ~/storage/downloads/index.js ~/storage/downloads/package.json ~/bot/
   cd ~/bot
   npm install
   ```
   If the sticker package fails to install, ignore it. Everything else still works.
4. Start and link (see "Linking" below):
   ```bash
   PHONE_NUMBER=2348011111111 OWNER_NUMBER=2348022222222 BOT_NAME=MyBot node index.js
   ```
5. Keep it alive in the background:
   ```bash
   termux-wake-lock
   npm i -g pm2
   PHONE_NUMBER=2348011111111 OWNER_NUMBER=2348022222222 pm2 start index.js --name bot
   pm2 save
   ```
   In Android settings, set Termux battery usage to "Unrestricted".

## Option B: free cloud VM (Oracle Cloud "Always Free")

Gives a real always-on Linux server for free, but signup asks for a card for verification and free capacity is not always available.

```bash
sudo apt update && sudo apt install -y git ffmpeg curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
mkdir bot && cd bot        # upload index.js and package.json here
npm install
sudo npm i -g pm2
PHONE_NUMBER=... OWNER_NUMBER=... pm2 start index.js --name bot
pm2 save && pm2 startup    # run the command it prints, to start on reboot
```

## Option C: your own PC

Same as Option B (install Node 18+), but the bot is only online while the PC is on.

## Free app platforms (Render, Koyeb, Railway, etc.)

Not recommended for this bot. Free plans usually sleep or restart the app and wipe the disk, which deletes the `session/` folder, so you would have to re-link repeatedly. Plans and limits change often, so check current terms before trying one.

## Linking the bot number

1. Make sure the separate number has WhatsApp installed and working on a phone.
2. Run the bot with `PHONE_NUMBER` set to that number. After about 3 seconds the terminal prints `Pairing code: ABCD-EFGH`.
3. On the phone with the bot number: WhatsApp > Settings > Linked Devices > Link a Device > **Link with phone number instead**, then type the code.
4. The terminal prints `connected`. Done. The login is saved in `session/`, so next time you just run the bot.
5. From your personal number, message the bot number `.menu`. If `.off` says "Owner only", send `.myid` and set `OWNER_NUMBER` to the digits shown.

To re-link: stop the bot, delete the `session/` folder, run again.

## Notes

- Unofficial library: don't spam, mass-message or add people to groups in bulk, or the number can be banned. A separate number limits the damage.
- Never share or upload the `session/` folder. Anyone with it controls the bot number.

# Getting this onto Vercel

Two routes. **Route A needs nothing installed on your Mac** and is the fastest
way to a shareable link. Route B is the full local setup, worth doing when you
want to edit the prototype yourself.

---

## Route A — browser only (no installs)

You need a GitHub account and a Vercel account. Nothing else.

1. **Make a repository.** Go to <https://github.com/new>, name it
   `wakanow-packages-prototype`, leave it Private, and click *Create
   repository*. Do not tick "Add a README" — the project already has one.

2. **Upload the project.** On the empty repository page, click
   *uploading an existing file*. Unzip the project folder on your Mac first,
   then drag **the contents** of `wakanow-packages-prototype` into the browser
   window — all the files and folders, but not the enclosing folder itself.
   Skip `node_modules` and `dist` if they are present; they are rebuilt
   automatically.

   Click *Commit changes*.

3. **Import it into Vercel.** Go to <https://vercel.com/new>, connect your
   GitHub account if prompted, find the repository and click *Import*.

4. **Deploy.** Vercel detects Vite on its own — Framework Preset *Vite*, build
   command `npm run build`, output directory `dist`. Do not change them. Click
   *Deploy*.

About a minute later you get a live URL like
`wakanow-packages-prototype.vercel.app`. Every later push to the repository
redeploys it automatically.

---

## Route B — full local setup

This is the part I could not do for you: installing software on your MacBook.
Each step is a copy-paste line in **Terminal** (⌘-Space, type "Terminal").

### 1. Node.js

Check whether you already have a new enough version:

```bash
node -v
```

You want **v20.19+ or v22.12+**. If the command is not found, or the number is
lower, download the LTS installer from <https://nodejs.org> and run it. Then
close Terminal, reopen it, and check again:

```bash
node -v
npm -v
```

### 2. A code editor

Download **Visual Studio Code** from <https://code.visualstudio.com> and drag it
into Applications. It is the friendliest of the options and has good React
support out of the box.

### 3. Git

macOS usually has it. Check:

```bash
git --version
```

If macOS offers to install the developer tools, accept. Then set your identity —
this is what shows up on commits:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@wakanow.com"
```

### 4. Run the prototype

Unzip the project, then in Terminal:

```bash
cd ~/Downloads/wakanow-packages-prototype   # or wherever you put it
npm install
npm run dev
```

Open the URL it prints (usually <http://localhost:5173>). Leave it running —
edits to files under `src/` appear in the browser immediately.

Press `Ctrl-C` in Terminal to stop it.

### 5. Push it to GitHub

Create an empty repository at <https://github.com/new> (Private, no README),
copy the URL it gives you, then:

```bash
git init
git add .
git commit -m "Wakanow Packages Phase 1 prototype"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/wakanow-packages-prototype.git
git push -u origin main
```

GitHub will ask you to sign in the first time. If it asks for a password, it
wants a **personal access token**, not your account password — GitHub's prompt
links to the page that creates one.

### 6. Deploy

Either import the repository at <https://vercel.com/new> as in Route A — which
also gives you automatic redeploys on every push — or use the CLI:

```bash
npm install -g vercel
vercel login
vercel
```

Accept the defaults it offers. `vercel` gives you a preview URL;
`vercel --prod` promotes it to the production domain.

---

## If something goes wrong

**`npm install` fails with an engine warning** — your Node is too old. Redo
step 1 and make sure `node -v` reports 20.19+ or 22.12+.

**`command not found: npm`** — Node did not install, or Terminal is still the
old session. Quit Terminal completely (⌘-Q) and reopen it.

**Vercel builds but the page is blank** — check the deployment's Build Logs in
the Vercel dashboard. A blank page with no build error usually means the output
directory is wrong; it should be `dist`.

**A deep link like `/builder` 404s** — it should not, because the app uses hash
routing (`/#/builder`). If you switched to `BrowserRouter`, add a `vercel.json`
with a catch-all rewrite to `/index.html`.

**Fonts look wrong** — the page loads Plus Jakarta Sans and DM Sans from Google
Fonts. On a network that blocks them you get system fonts and slightly different
spacing; the layout is unaffected.

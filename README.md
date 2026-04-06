 # Orbit Visualizer Interface

 This is a code bundle for Orbit Visualizer Interface. The project is currently a prototype/playground — expect missing pieces.

 ## Prerequisites

- Node.js (recommended LTS)
- Python 3.8+ (for backend scripts)
- MySQL Server (Community / Server 8.x on Windows is used in these instructions)

## 1) MySQL (Windows) — install & quick setup

Follow these steps to install MySQL and make it easy to start/stop from PowerShell.

1. Download and run the **MySQL Installer (Community)** from MySQL's website and follow the installer UI.
2. When the installer asks to configure accounts, set a **root** password and do NOT create any additional user accounts (the project expects root access for prototype convenience).
3. Use the default port `3306`. Note the service name (default for MySQL 8 on Windows is `MySQL80`) — the included PowerShell helpers rely on this name.
4. Finish the installation and verify MySQL service is present in Services.msc.

Notes & alternatives:
- If you prefer Linux/macOS, install MySQL via your package manager and adapt service names (`systemctl start mysql` / `brew services start mysql`).
- For security, do not use root in production. This repo is a prototype — the README asks for root-only for convenience.

## 2) Add PowerShell helpers (optional but recommended)

To make it trivial to start/stop MySQL and open the shell, add these functions to your global PowerShell profile (`$PROFILE`).

Open your profile in an editor (PowerShell):

```powershell
notepad $PROFILE
```

Paste the following functions into the file, save, then either restart PowerShell or run `. $PROFILE` to load them immediately.

```powershell
function mysql-start {
  param(
    [Parameter(Mandatory=$false)]
    [string]$db_name = ""
  )

  $service = Get-Service -Name "MySQL80" -ErrorAction SilentlyContinue
    
  if ($null -eq $service) {
    Write-Host "Error: 'MySQL80' service not found." -ForegroundColor Red
    return
  }

  if ($service.Status -ne 'Running') {
    Write-Host "🔧 Waking up the MySQL Engine..." -ForegroundColor Yellow
    gsudo net start MySQL80
  } else {
    Write-Host "MySQL is already purring on port 3306." -ForegroundColor Cyan
  }

  if ($db_name -ne "") {
    $dbPath = "C:\ProgramData\MySQL\MySQL Server 8.0\Data\$db_name"
        
    if (Test-Path $dbPath) {
      Write-Host "Entering $db_name..." -ForegroundColor Green
      mysqlsh --sql -u root --schema=$db_name
    } else {
      Write-Host "Warning: Database '$db_name' not found. Opening general prompt..." -ForegroundColor Red
      mysqlsh --sql -u root
    }
  } else {
    Write-Host "Opening MySQL Shell (No database selected)..." -ForegroundColor Gray
    mysqlsh --sql -u root
  }
}

Set-Alias -Name db -Value mysql-start

function mysql-stop {
  $service = Get-Service -Name "MySQL80" -ErrorAction SilentlyContinue
    
  if ($service.Status -eq 'Stopped') {
    Write-Host "MySQL is already asleep. No action needed." -ForegroundColor Cyan
  } elseif ($service -eq $null) {
    Write-Host "Error: MySQL80 service not found. Check the name in Services.msc" -ForegroundColor Red
  } else {
    Write-Host "Terminating the MySQL Engine..." -ForegroundColor Yellow
    gsudo net stop MySQL80
    Write-Host "System Clear. RAM freed." -ForegroundColor Green
  }
}
```

Notes:
- The functions use `gsudo` to elevate when starting/stopping the Windows service. If you don't have `gsudo`, run PowerShell as Administrator or replace `gsudo` with `Start-Service` / `Stop-Service` as appropriate.

Installing `gsudo` (recommended):

Install `gsudo` via `winget` (this README assumes `winget` is used):

```powershell
winget install --id gsudo.gsudo -e --source winget
```

After installation, verify with:

```powershell
gsudo --version
```

If you cannot install `gsudo`, run PowerShell as Administrator when using `mysql-start`/`mysql-stop` or edit the functions to use `Start-Service`/`Stop-Service` instead.

## 3) Project setup — terminal command summary

Below are the commands you (and your friends) can run from the project root. Run them in order.

```bash
# Create & activate Python virtual environment (Windows PowerShell)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install Python dependencies (from requirements.txt)
pip install -r requirements.txt

# Install JS dependencies (single canonical command)
npm install

# Start development server
npm run dev
```

Notes:
- Use `npm install` (single canonical command) — it reads `package.json` and installs packages into `node_modules`.
- If you set up a Python `venv`, remember to activate it before running `pip install -r requirements.txt`.

## 4) Typical workflow (quick)

1. Start MySQL (PowerShell):

```powershell
mysql-start    # or: db
```

2. Start dev server (project root):

```bash
npm run dev
```

3. Stop MySQL when done:

```powershell
mysql-stop
```

## 5) Additional tips

- This README standardises on `npm install` for JS dependency installation.
- Don't use the root account in production; this repo is a prototype and uses root for simplicity only.
- If teammates have trouble with elevation in PowerShell, instruct them to run PowerShell as Administrator once to install the service, or install `gsudo` (recommended lightweight sudo for Windows).

---

If you'd like, I can also add a short `.github/ISSUE_TEMPLATE.md` or a separate `SETUP.md` with platform-specific notes (macOS/Linux).

  
  
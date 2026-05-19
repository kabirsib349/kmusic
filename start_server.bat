@echo off
title KMusic Server
chcp 65001 >nul

:: ========================================================
:: Ce script DOIT etre lance en tant qu'Administrateur
:: pour pouvoir modifier les parametres energie/reseau.
:: ========================================================

:: Verifier les droits Administrateur
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  [!] ERREUR : Lancer ce script en tant qu'Administrateur !
    echo  [!] Clic droit sur start_server.bat - Executer en tant qu'administrateur
    echo.
    pause
    exit /b 1
)

echo.
echo  ================================================
echo             KMusic - Serveur Personnel         
echo           Activation du mode "Toujours ON"     
echo  ================================================
echo.

:: 1. DESACTIVER LA MISE EN VEILLE 
echo  [1/5] Desactivation de la mise en veille...
powercfg -change -standby-timeout-ac 0
powercfg -change -standby-timeout-dc 0

:: 2. DESACTIVER L'HIBERNATION
echo  [2/5] Desactivation de l'hibernation...
powercfg -change -hibernate-timeout-ac 0
powercfg -change -hibernate-timeout-dc 0
powercfg -h off

:: 3. DESACTIVER LA VEILLE DU DISQUE DUR
echo  [3/5] Desactivation de la veille du disque dur...
powercfg -change -disk-timeout-ac 0
powercfg -change -disk-timeout-dc 0

:: 4. DESACTIVER LA COUPURE DU MONITEUR 
echo  [4/5] Desactivation de la coupure moniteur (Modern Standby)...
powercfg -change -monitor-timeout-ac 0
powercfg -change -monitor-timeout-dc 0

:: 5. INTERDIRE A WINDOWS DE COUPER LE WI-FI
echo  [5/5] Interdiction de couper le Wi-Fi pour economiser l'energie...
powershell -Command "Get-NetAdapter | ForEach-Object { try { Set-NetAdapterPowerManagement -Name $_.Name -AllowComputerToTurnOffDevice Disabled -ErrorAction Stop; Write-Host ('   - ' + $_.Name + ' : OK') } catch { Write-Host ('   - ' + $_.Name + ' : ignore') } }"

echo.
echo  [OK] Mode Serveur active - Le PC ne se coupera plus !
echo.

:: Activer l'environnement Python et lancer le serveur
cd /d "%~dp0"
call venv\Scripts\activate.bat

:: Ajouter FFmpeg au PATH si installe via winget
set "FFMPEG_PATH=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin"
if exist "%FFMPEG_PATH%" set "PATH=%FFMPEG_PATH%;%PATH%"

:: Lancer Cloudflare Tunnel dans une nouvelle fenetre
echo  [OK] Lancement du tunnel Cloudflare (Vitesse CDN ultra-rapide et illimitee)...
start "KMusic - Tunnel Cloudflare" cmd /k "cloudflared tunnel --protocol http2 --url http://localhost:5000"

echo.
echo  ========================================================
echo   LANCE L'URL EN ".trycloudflare.com" AFFICHEE DANS LA
echo   DEUXIEME FENETRE "KMusic - Tunnel Cloudflare" SUR TON TELEPHONE !
echo  ========================================================
echo.
echo  [!] Lancement du serveur... 
echo  [!] Pour tout arreter proprement, appuie sur CTRL+C ici.
echo.

python app.py

:: RESTAURATION A LA FERMETURE DU SERVEUR
echo.
echo  [!] Serveur arrete. Restauration des parametres energie...

powercfg -change -standby-timeout-ac 30
powercfg -change -standby-timeout-dc 15
powercfg -change -hibernate-timeout-ac 60
powercfg -change -disk-timeout-ac 20
powercfg -change -monitor-timeout-ac 10
powercfg -change -monitor-timeout-dc 5
powercfg -h on

powershell -Command "Get-NetAdapter | ForEach-Object { try { Set-NetAdapterPowerManagement -Name $_.Name -AllowComputerToTurnOffDevice Enabled -ErrorAction Stop } catch {} }"

echo  [OK] Parametres energie restaures. A bientot !
echo.
pause

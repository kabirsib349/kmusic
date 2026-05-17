# KMusic

Application de streaming musical personnel, auto-hebergee. Inspirée des grandes applications comme Spotify et Apple Music, elle permet d'ecouter ta bibliotheque musicale depuis n'importe ou dans le monde, sur telephone ou PC.

## Fonctionnalites

- Lecteur audio complet : Lecture, pause, suivant, precedent, repetition, lecture aleatoire
- Interface mobile native : Mini-lecteur compact + plein ecran immersif (style Apple Music)
- Gestes tactiles : Swipe vers le bas pour fermer, swipe gauche/droite pour zapper
- Pochettes automatiques : Recuperation des vraies pochettes via FFmpeg lors du telechargement YouTube
- Telechargement YouTube : Colle une URL YouTube et telecharge directement en MP3 HD
- Upload de fichiers : Importe tes propres fichiers audio (MP3, FLAC, OGG, AAC, M4A, WAV)
- Recherche en temps reel : Filtre par titre, artiste ou album
- Selection multiple : Supprime plusieurs pistes en meme temps
- Temps reel : Mises a jour instantanees via WebSocket (SocketIO)
- Design sombre premium : Interface glassmorphism avec animations fluides

## Stack Technique

- Backend : Python, Flask, Flask-SocketIO
- Base de donnees : SQLite (via Flask-SQLAlchemy)
- Frontend : HTML5, CSS3 Vanilla, JavaScript ES6+
- Audio : API Web Audio + Streaming HTTP Range
- Telechargement : yt-dlp
- Conversion : FFmpeg
- Surveillance dossier : Watchdog
- Acces public : ngrok (tunnel HTTP securise)

## Deploiement Local (Windows)

L'application est configuree pour tourner localement sur un PC Windows et etre accessible depuis internet via ngrok.

### 1. Pre-requis
- Python 3.10+
- FFmpeg (installe via winget ou ajoute au PATH)
- Un compte ngrok avec un authtoken configure

### 2. Installation
```cmd
git clone https://github.com/kabirsib349/kmusic.git
cd kmusic
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Lancement du serveur
Un script automatise est fourni. Il lance le serveur Python, ouvre un tunnel ngrok avec votre domaine fixe, et desactive temporairement la mise en veille de Windows pour eviter les coupures.

Faites un clic droit sur `start_server.bat` et selectionnez "Executer en tant qu'administrateur".

### 4. Acces
L'URL publique (ngrok) s'affichera dans la console. Vous pouvez l'utiliser sur votre telephone ou n'importe quel autre appareil.

## Structure du projet

kmusic/
|-- app.py              # Application principale Flask
|-- database.py         # Modeles SQLAlchemy (Track)
|-- scanner.py          # Scanner de dossier + extraction metadonnees
|-- requirements.txt    # Dependances Python
|-- start_server.bat    # Script automatise pour Windows
|-- static/
|   |-- css/
|   |   `-- style.css   # Design complet (dark mode, animations)
|   |-- js/
|   |   `-- app.js      # Logique frontend (player, swipes, SocketIO)
|   |-- icons/          # Icones PWA
|   |-- img/            # Pochette par defaut
|   `-- manifest.json   # PWA manifest
|-- templates/
|   `-- index.html      # Template principal
`-- music/              # Dossier des fichiers audio (non versionne)

## Notes

- La base de donnees kmusic.db est creee automatiquement au premier demarrage.
- Le dossier music/ est surveille en temps reel par Watchdog.
- Les musiques telechargees via YouTube sont converties en MP3 192kbps.
- Les pochettes sont incrustees directement dans les fichiers MP3 via FFmpeg.

---
KMusic - Ton Spotify personnel, auto-heberge.

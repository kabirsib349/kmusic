# KMusic

Application de streaming musical personnel, hébergée sur Oracle Cloud. Inspirée des grandes applications comme **Spotify** et **Apple Music**, elle permet d'écouter ta bibliothèque musicale depuis n'importe où dans le monde, sur téléphone ou PC.

##  Fonctionnalités

-  **Lecteur audio complet** — Lecture, pause, suivant, précédent, répétition, lecture aléatoire
-  **Interface mobile native** — Mini-lecteur compact + plein écran immersif (style Apple Music)
-  **Gestes tactiles** — Swipe vers le bas pour fermer, swipe gauche/droite pour zapper
-  **Pochettes automatiques** — Récupération des vraies pochettes via FFmpeg lors du téléchargement YouTube
-  **Téléchargement YouTube** — Colle une URL YouTube et télécharge directement en MP3 HD
-  **Upload de fichiers** — Importe tes propres fichiers audio (MP3, FLAC, OGG, AAC, M4A, WAV)
-  **Recherche en temps réel** — Filtre par titre, artiste ou album
-  **Sélection multiple** — Supprime plusieurs pistes en même temps
-  **Temps réel** — Mises à jour instantanées via WebSocket (SocketIO)
-  **Design sombre premium** — Interface glassmorphism avec animations fluides

##  Stack Technique

| Composant | Technologie |
|-----------|------------|
| Backend | Python, Flask, Flask-SocketIO |
| Base de données | SQLite (via Flask-SQLAlchemy) |
| Frontend | HTML5, CSS3 Vanilla, JavaScript ES6+ |
| Audio | API Web Audio + Streaming HTTP Range |
| Téléchargement | yt-dlp |
| Conversion | FFmpeg |
| Surveillance dossier | Watchdog |
| Serveur production | Gunicorn + Eventlet |

##  Déploiement (Oracle Cloud - Ubuntu)

### 1. Cloner le projet
```bash
git clone https://github.com/TON_COMPTE/kmusic.git
cd kmusic
```

### 2. Installer les dépendances système
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv ffmpeg
```

### 3. Créer l'environnement virtuel
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install eventlet
```

### 4. Lancer en production
```bash
chmod +x start.sh
./start.sh
```

### 5. Accès
Ouvre ton navigateur sur `http://TON_IP_ORACLE:5000`

##  Structure du projet

```
kmusic/
├── app.py              # Application principale Flask
├── database.py         # Modèles SQLAlchemy (Track)
├── scanner.py          # Scanner de dossier + extraction métadonnées
├── requirements.txt    # Dépendances Python
├── start.sh            # Script de démarrage Linux (production)
├── static/
│   ├── css/
│   │   └── style.css   # Design complet (dark mode, animations)
│   ├── js/
│   │   └── app.js      # Logique frontend (player, swipes, SocketIO)
│   ├── icons/          # Icônes PWA
│   ├── img/            # Pochette par défaut
│   └── manifest.json   # PWA manifest
├── templates/
│   └── index.html      # Template principal
└── music/              # Dossier des fichiers audio (non versionné)
```

##  Configuration requise

- Python 3.10+
- FFmpeg installé sur le système
- Au minimum 512 MB de RAM (recommandé 1 GB+)

##  Notes

- La base de données `kmusic.db` est créée automatiquement au premier démarrage
- Le dossier `music/` est surveillé en temps réel par Watchdog
- Les musiques téléchargées via YouTube sont converties en MP3 192kbps
- Les pochettes sont incrustées directement dans les fichiers MP3 via FFmpeg

---
*KMusic — ton Spotify personnel, auto-hébergé.*

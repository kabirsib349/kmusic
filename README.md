# KMusic

Application de streaming musical personnel, auto-hébergée. Inspirée des grandes applications comme **Spotify** et **Apple Music**, elle permet d'écouter ta bibliothèque musicale depuis n'importe où dans le monde, sur téléphone ou PC.

## Fonctionnalités

- **Lecteur audio complet** — Lecture, pause, suivant, précédent, répétition, lecture aléatoire
- **Interface mobile native** — Mini-lecteur compact + plein écran immersif (style Apple Music)
- **Gestes tactiles** — Swipe vers le bas pour fermer, swipe gauche/droite pour zapper
- **Pochettes automatiques** — Récupération des vraies pochettes via FFmpeg lors du téléchargement YouTube
- **Téléchargement YouTube** — Colle une URL YouTube et télécharge directement en MP3 HD
- **Upload de fichiers** — Importe tes propres fichiers audio (MP3, FLAC, OGG, AAC, M4A, WAV)
- **Recherche en temps réel** — Filtre par titre, artiste ou album
- **Sélection multiple** — Supprime plusieurs pistes en même temps
- **Temps réel** — Mises à jour instantanées via WebSocket (SocketIO)
- **Design sombre premium** — Interface glassmorphism avec animations fluides

## Stack Technique

| Composant | Technologie |
|-----------|------------|
| Backend | Python, Flask, Flask-SocketIO |
| Base de données | SQLite (via Flask-SQLAlchemy) |
| Frontend | HTML5, CSS3 Vanilla, JavaScript ES6+ |
| Audio | API Web Audio + Streaming HTTP Range |
| Téléchargement | yt-dlp |
| Conversion | FFmpeg |
| Surveillance dossier | Watchdog |
| Accès public | Cloudflare Tunnel (tunnel sécurisé ultra-rapide) |

## Déploiement Local (Windows)

L'application est configurée pour tourner localement sur un PC Windows et être accessible depuis internet via un tunnel Cloudflare.

### 1. Pré-requis
- Python 3.10+
- FFmpeg (installé via winget ou ajouté au PATH)
- Cloudflare Tunnel (installé automatiquement via winget)

### 2. Installation
```cmd
git clone https://github.com/kabirsib349/kmusic.git
cd kmusic
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Lancement du serveur
Un script automatisé est fourni. Il lance le serveur Python, ouvre un tunnel Cloudflare ultra-rapide (sans inscription), et désactive temporairement la mise en veille de Windows pour éviter les coupures réseau.

Faites un clic droit sur `start_server.bat` et sélectionnez **Exécuter en tant qu'administrateur**.

### 4. Accès
L'URL publique (Cloudflare) s'affichera dans la console. Vous pouvez l'utiliser sur votre téléphone ou n'importe quel autre appareil.

## Structure du projet

```text
kmusic/
├── app.py              # Application principale Flask
├── database.py         # Modèles SQLAlchemy (Track)
├── scanner.py          # Scanner de dossier + extraction métadonnées
├── requirements.txt    # Dépendances Python
├── start_server.bat    # Script automatisé pour Windows
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

## Notes

- La base de données `kmusic.db` est créée automatiquement au premier démarrage
- Le dossier `music/` est surveillé en temps réel par Watchdog
- Les musiques téléchargées via YouTube sont converties en MP3 192kbps
- Les pochettes sont incrustées directement dans les fichiers MP3 via FFmpeg

---
*KMusic — Ton Spotify personnel, auto-hébergé.*

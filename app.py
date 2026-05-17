import os
import threading
import re
from flask import Flask, render_template, jsonify, request, send_file, Response
from flask_socketio import SocketIO
from flask_cors import CORS
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from database import db, Track
from scanner import scan_music_folder, extract_metadata, AUDIO_EXTENSIONS

# ── Configuration ──────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MUSIC_FOLDER = os.path.join(BASE_DIR, "music")

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{os.path.join(BASE_DIR, 'kmusic.db')}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "kmusic-super-secret-key-2024")  # Surcharger via variable d'environnement en prod
app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024  # 500 MB max upload

db.init_app(app)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")


# ── Watchdog (surveillance dossier music en temps réel) ────────────────────────
class MusicFolderHandler(FileSystemEventHandler):
    def __init__(self, flask_app, sio):
        self.app = flask_app
        self.sio = sio

    def on_created(self, event):
        if event.is_directory:
            return
        ext = os.path.splitext(event.src_path)[1].lower()
        if ext in AUDIO_EXTENSIONS:
            with self.app.app_context():
                existing = Track.query.filter_by(file_path=event.src_path).first()
                if not existing:
                    track = extract_metadata(event.src_path)
                    if track:
                        db.session.add(track)
                        db.session.commit()
                        self.sio.emit("track_added", track.to_dict())

    def on_deleted(self, event):
        if event.is_directory:
            return
        with self.app.app_context():
            track = Track.query.filter_by(file_path=event.src_path).first()
            if track:
                tid = track.id
                db.session.delete(track)
                db.session.commit()
                self.sio.emit("track_removed", {"id": tid})

    def on_moved(self, event):
        if event.is_directory:
            return
        with self.app.app_context():
            old = Track.query.filter_by(file_path=event.src_path).first()
            if old:
                tid = old.id
                db.session.delete(old)
                db.session.commit()
                self.sio.emit("track_removed", {"id": tid})
            new_ext = os.path.splitext(event.dest_path)[1].lower()
            if new_ext in AUDIO_EXTENSIONS:
                existing_new = Track.query.filter_by(file_path=event.dest_path).first()
                if not existing_new:
                    track = extract_metadata(event.dest_path)
                    if track:
                        db.session.add(track)
                        try:
                            db.session.commit()
                            self.sio.emit("track_added", track.to_dict())
                        except Exception:
                            db.session.rollback()


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/tracks", methods=["GET"])
def get_tracks():
    tracks = Track.query.order_by(Track.added_at.desc()).all()
    return jsonify([t.to_dict() for t in tracks])


@app.route("/api/tracks/<int:track_id>", methods=["DELETE"])
def delete_track(track_id):
    track = Track.query.get(track_id)
    if not track:
        return jsonify({"error": "Piste non trouvée"}), 404
        
    try:
        if os.path.exists(track.file_path):
            os.remove(track.file_path)
            
        db.session.delete(track)
        db.session.commit()
        
        socketio.emit("track_removed", {"id": track_id})
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/tracks/batch", methods=["DELETE"])
def delete_tracks_batch():
    data = request.get_json()
    if not data or "ids" not in data:
        return jsonify({"error": "Aucun ID fourni"}), 400
        
    ids = data["ids"]
    deleted_ids = []
    
    try:
        for track_id in ids:
            track = Track.query.get(track_id)
            if track:
                if os.path.exists(track.file_path):
                    os.remove(track.file_path)
                db.session.delete(track)
                deleted_ids.append(track_id)
                
        db.session.commit()
        
        for tid in deleted_ids:
            socketio.emit("track_removed", {"id": tid})
            
        return jsonify({"success": True, "deleted": deleted_ids})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/tracks/<int:track_id>/stream")
def stream_track(track_id):
    track = Track.query.get_or_404(track_id)
    if not os.path.exists(track.file_path):
        return jsonify({"error": "Fichier introuvable"}), 404

    file_size = os.path.getsize(track.file_path)
    range_header = request.headers.get("Range")

    # Déterminer le MIME type
    ext = os.path.splitext(track.file_path)[1].lower()
    mime_map = {
        ".mp3": "audio/mpeg", ".flac": "audio/flac",
        ".ogg": "audio/ogg", ".aac": "audio/aac",
        ".m4a": "audio/mp4", ".wav": "audio/wav",
    }
    mime = mime_map.get(ext, "audio/mpeg")

    if range_header:
        byte1, byte2 = 0, file_size - 1
        parts = range_header.replace("bytes=", "").split("-")
        byte1 = int(parts[0])
        if parts[1]:
            byte2 = int(parts[1])
        length = byte2 - byte1 + 1

        with open(track.file_path, "rb") as f:
            f.seek(byte1)
            data = f.read(length)

        rv = Response(data, 206, mimetype=mime, direct_passthrough=True)
        rv.headers.add("Content-Range", f"bytes {byte1}-{byte2}/{file_size}")
        rv.headers.add("Accept-Ranges", "bytes")
        rv.headers.add("Content-Length", str(length))
        return rv

    return send_file(track.file_path, mimetype=mime)


@app.route("/api/tracks/<int:track_id>/cover")
def get_cover(track_id):
    track = Track.query.get_or_404(track_id)
    if track.cover_data and track.cover_mime:
        return Response(track.cover_data, mimetype=track.cover_mime)
    # Pochette par défaut
    default = os.path.join(BASE_DIR, "static", "img", "default_cover.png")
    if os.path.exists(default):
        return send_file(default, mimetype="image/png")
    return Response(status=204)


@app.route("/api/upload", methods=["POST"])
def upload_track():
    if "files[]" not in request.files:
        return jsonify({"error": "Aucun fichier"}), 400

    files = request.files.getlist("files[]")
    added = []
    errors = []

    for file in files:
        if not file.filename:
            continue
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in AUDIO_EXTENSIONS:
            errors.append(f"{file.filename}: format non supporté")
            continue

        save_path = os.path.join(MUSIC_FOLDER, file.filename)
        try:
            file.save(save_path)
            # Ajouter directement en DB (le watchdog peut prendre un instant)
            with app.app_context():
                existing = Track.query.filter_by(file_path=save_path).first()
                if not existing:
                    track = extract_metadata(save_path)
                    if track:
                        db.session.add(track)
                        db.session.commit()
                        socketio.emit("track_added", track.to_dict())
                        added.append(track.to_dict())
        except Exception as e:
            errors.append(f"{file.filename}: {str(e)}")

    return jsonify({"added": added, "errors": errors})


@app.route("/api/youtube", methods=["POST"])
def youtube_download():
    """Télécharger l'audio d'une URL YouTube via yt-dlp."""
    data = request.get_json()
    url = (data or {}).get("url", "").strip()

    if not url:
        return jsonify({"error": "URL manquante"}), 400

    # Validation basique de l'URL YouTube
    yt_pattern = r"(youtube\.com/(watch|shorts|playlist)|youtu\.be/)"
    if not re.search(yt_pattern, url):
        return jsonify({"error": "URL YouTube invalide"}), 400

    # Lancer le téléchargement dans un thread séparé
    def do_download():
        import yt_dlp
        current_ui_title = "..."

        try:
            # 1. Snapshot des fichiers existants AVANT download
            files_before = set()
            for root, dirs, files in os.walk(MUSIC_FOLDER):
                for f in files:
                    files_before.add(os.path.join(root, f))

            # Affichage immédiat dans l'UI avec l'URL en attendant l'extraction
            tmp_title = f"Extraction: {url}"
            current_ui_title = tmp_title
            socketio.emit("yt_progress", {"status": "starting", "title": tmp_title, "percent": 0})

            # 2. Récupérer le titre sans télécharger
            with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "noplaylist": True}) as ydl:
                info = ydl.extract_info(url, download=False)
                title = info.get("title", "Titre inconnu")

            # Mettre à jour le vrai titre dans l'UI
            current_ui_title = title
            socketio.emit("yt_progress", {"status": "rename", "old_title": tmp_title, "new_title": title})

            # 3. Lancer le téléchargement avec conversion MP3 via ffmpeg
            ydl_opts = {
                "format": "bestaudio/best",
                "outtmpl": os.path.join(MUSIC_FOLDER, "%(title)s.%(ext)s"),
                "quiet": True,
                "no_warnings": True,
                "noplaylist": True,
                "writethumbnail": True,
                # Conversion automatique en MP3 via ffmpeg et incrustation pochette
                "postprocessors": [
                    {
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "mp3",
                        "preferredquality": "192",
                    },
                    {
                        "key": "EmbedThumbnail",
                    },
                    {
                        "key": "FFmpegMetadata",
                        "add_metadata": True,
                    },
                ],
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])

            # 4. Trouver les nouveaux fichiers (diff snapshot)
            with app.app_context():
                for root, dirs, files in os.walk(MUSIC_FOLDER):
                    for f in files:
                        path = os.path.join(root, f)
                        ext = os.path.splitext(f)[1].lower()
                        if path not in files_before and ext in AUDIO_EXTENSIONS:
                            existing = Track.query.filter_by(file_path=path).first()
                            if not existing:
                                track = extract_metadata(path)
                                if track:
                                    db.session.add(track)
                                    try:
                                        db.session.commit()
                                        socketio.emit("track_added", track.to_dict())
                                        print(f"[YouTube] Ajouté: {track.title}")
                                    except Exception:
                                        db.session.rollback()

            socketio.emit("yt_progress", {"status": "done", "title": title, "percent": 100})

        except Exception as e:
            print(f"[YouTube] Erreur: {e}")
            socketio.emit("yt_progress", {"status": "error", "title": current_ui_title, "message": str(e)})

    t = threading.Thread(target=do_download, daemon=True)
    t.start()
    return jsonify({"success": True, "message": "Téléchargement démarré"})





@app.route("/api/scan", methods=["POST"])
def rescan():
    with app.app_context():
        scan_music_folder(MUSIC_FOLDER, db, socketio)
    return jsonify({"success": True})


# ── Démarrage ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    os.makedirs(MUSIC_FOLDER, exist_ok=True)

    with app.app_context():
        db.create_all()
        print("[KMusic] Scan initial du dossier music...")
        scan_music_folder(MUSIC_FOLDER, db)

    # Démarrer la surveillance du dossier
    event_handler = MusicFolderHandler(app, socketio)
    observer = Observer()
    observer.schedule(event_handler, MUSIC_FOLDER, recursive=True)
    observer.start()
    print(f"[KMusic] Surveillance active sur: {MUSIC_FOLDER}")
    print(f"[KMusic] Serveur demarre -> http://localhost:5000")

    try:
        socketio.run(app, host="0.0.0.0", port=5000, debug=False, allow_unsafe_werkzeug=True)
    finally:
        observer.stop()
        observer.join()
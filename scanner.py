import os
from mutagen import File as MutagenFile
from database import Track

AUDIO_EXTENSIONS = {".mp3", ".flac", ".ogg", ".aac", ".m4a", ".wav", ".webm", ".opus"}


def extract_metadata(file_path):
    """Extraire les métadonnées d'un fichier audio et retourner un objet Track."""
    filename = os.path.basename(file_path)
    base_name = os.path.splitext(filename)[0]

    # Valeurs par défaut (utilisées si mutagen échoue)
    title = base_name
    artist = "Artiste inconnu"
    album = "Album inconnu"
    track_number = 0
    duration = 0
    cover_data = None
    cover_mime = None

    try:
        audio_easy = MutagenFile(file_path, easy=True)
        if audio_easy is not None:
            title  = str((audio_easy.get("title")  or [base_name])[0])
            artist = str((audio_easy.get("artist") or ["Artiste inconnu"])[0])
            album  = str((audio_easy.get("album")  or ["Album inconnu"])[0])

            track_num_raw = str((audio_easy.get("tracknumber") or ["0"])[0])
            try:
                track_number = int(track_num_raw.split("/")[0])
            except Exception:
                track_number = 0

            if hasattr(audio_easy, "info") and audio_easy.info:
                duration = getattr(audio_easy.info, "length", 0)
    except Exception as e:
        print(f"[Scanner] Avertissement métadonnées {filename}: {e}")

    # Extraction pochette (best-effort, ne bloque jamais)
    try:
        audio_raw = MutagenFile(file_path)
        if audio_raw and audio_raw.tags:
            for key in audio_raw.tags.keys():
                if key.startswith("APIC"):
                    cover_data = audio_raw.tags[key].data
                    cover_mime = audio_raw.tags[key].mime
                    break
        if audio_raw and hasattr(audio_raw, "pictures") and audio_raw.pictures:
            pic = audio_raw.pictures[0]
            cover_data = pic.data
            cover_mime = pic.mime
    except Exception:
        pass

    return Track(
        filename=filename,
        file_path=file_path,
        title=title,
        artist=artist,
        album=album,
        track_number=track_number,
        duration=duration,
        cover_data=cover_data,
        cover_mime=cover_mime,
    )


def scan_music_folder(music_folder, db, socketio=None):
    """Scanner le dossier music et mettre à jour la base de données."""
    os.makedirs(music_folder, exist_ok=True)

    existing = {t.file_path: t for t in Track.query.all()}
    found_paths = set()

    for root, dirs, files in os.walk(music_folder):
        for filename in files:
            ext = os.path.splitext(filename)[1].lower()
            if ext in AUDIO_EXTENSIONS:
                file_path = os.path.join(root, filename)
                found_paths.add(file_path)

                if file_path not in existing:
                    track = extract_metadata(file_path)
                    if track:
                        db.session.add(track)
                        db.session.commit()
                        print(f"[Scanner] Ajouté: {filename}")
                        if socketio:
                            socketio.emit("track_added", track.to_dict())

    # Supprimer les pistes dont le fichier n'existe plus
    for path, track in existing.items():
        if path not in found_paths:
            tid = track.id
            db.session.delete(track)
            db.session.commit()
            print(f"[Scanner] Supprimé: {track.filename}")
            if socketio:
                socketio.emit("track_removed", {"id": tid})

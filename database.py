from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class Track(db.Model):
    __tablename__ = "tracks"

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(500), nullable=False)
    file_path = db.Column(db.String(1000), unique=True, nullable=False)
    title = db.Column(db.String(500))
    artist = db.Column(db.String(500))
    album = db.Column(db.String(500))
    track_number = db.Column(db.Integer, default=0)
    duration = db.Column(db.Float, default=0)
    cover_data = db.Column(db.LargeBinary)
    cover_mime = db.Column(db.String(50))
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "filename": self.filename,
            "title": self.title or self.filename,
            "artist": self.artist or "Artiste inconnu",
            "album": self.album or "Album inconnu",
            "track_number": self.track_number,
            "duration": self.duration,
            "has_cover": self.cover_data is not None,
            "added_at": self.added_at.isoformat() if self.added_at else None,
        }

#!/bin/bash
# Script de démarrage pour la production (Linux/Oracle Cloud)
# Lance KMusic avec Gunicorn (serveur WSGI de production)

echo "======================================="
echo "  KMusic - Démarrage en production"
echo "======================================="

# Créer le dossier music s'il n'existe pas
mkdir -p music

# Créer/migrer la base de données
python -c "from app import app, db; app.app_context().__enter__(); db.create_all()"

# Lancer avec gunicorn + eventlet pour le support SocketIO
exec gunicorn --worker-class eventlet -w 1 \
    --bind 0.0.0.0:5000 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    "app:app"

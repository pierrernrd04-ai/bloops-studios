# Pages d'enregistrement des épisodes (artifacts claude.ai)

Un artifact accepte des fichiers de 20 Mo au plus et 1 Go par page. Pour qu'on puisse enregistrer un épisode
complet (200 à 270 Mo) depuis une page, chaque `episode.mp4` est découpé en morceaux de 19 Mo
(`split -b 19922944`), les morceaux sont envoyés dans le stockage d'une page (environ 4 épisodes par page),
et le bouton « Enregistrer la vidéo » télécharge les morceaux, les recolle dans le navigateur
(`new Blob([...])`, fichier identique à l'octet près) puis propose l'enregistrement (capacité `downloads`).

- `vault_tpl.html` : la page ; `vault_build.py N` : construit la page du lot N ;
  `add_assets.py N` : enregistre les adresses renvoyées par l'envoi des morceaux.

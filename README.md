# Bloops Studio — générateur de vidéos de comptines pour enfants

Bloops Studio fabrique automatiquement des épisodes de **20 à 30 minutes** pour les chaînes
**Bloop Town** (anglais) et **Bloop Ville** (français). Chaque épisode est composé de chansons
chantées, de paroles karaoké à l'écran et de petits jeux éducatifs, entièrement générés par code.
Il n'y a aucune image ni aucun son repris d'une autre chaîne.

## Ce que contient chaque épisode

- **10 à 13 chansons**, sur des mélodies traditionnelles du domaine public (Wheels on the Bus, Old MacDonald,
  Twinkle Twinkle, Row Row, London Bridge, Frère Jacques, Mary Had a Little Lamb, Yankee Doodle,
  Au clair de la lune). Les **paroles sont originales**, en anglais et en français. S'y ajoutent des **mélodies inédites
  générées** à chaque épisode (chansons de danse).
- **Des leçons interactives** : compter, trouver la bonne couleur, reconnaître les formes, deviner l'animal.
- **Un présentateur, Bloopy**, qui parle avec la bouche synchronisée sur sa voix, présente les chansons et félicite les enfants.
- **Des décors variés** : route en ville, campagne, champ de fleurs, coucher de soleil, ferme, mer, neige, nuit étoilée, scène de spectacle.
- **Des personnages** : les Bloops (boules colorées) et leurs costumes d'animaux (vache, cochon, canard, mouton, chat, chien,
  poule, grenouille, poisson, crabe, baleine, pieuvre, tortue, dauphin, étoile de mer, méduse).
- **Des objets** : fruits, formes, véhicules (bus, train, bateau, voiture, avion, fusée, tracteur), ballons, étoiles.
- **Des arrangements musicaux** synthétisés (flûte, marimba, piano, clarinette, accordéon, glockenspiel, ukulélé,
  basse, percussions). Le tempo, la tonalité et l'instrumentation changent à chaque chanson.

Le **seed** (un nombre) détermine tout l'épisode : les chansons, l'ordre, les couleurs, les animaux, les voix, les décors et les tempos.
Deux seeds différents donnent deux épisodes différents.

## Les 30 voix (gratuites, utilisables commercialement)

| Langue | Moteur | Voix | Licence |
|---|---|---|---|
| Anglais (15) | Kokoro v1.0 | heart, bella, nicole, aoede, kore, sarah, nova, sky, emma, isabella, michael, fenrir, puck, george, fable | Apache-2.0 |
| Français (13) | Kokoro v1.0 | siwis en 13 timbres : Siwis, Lila (enfant), Zoé, Nina, Rose, Jade, Mila, Léo, Tom, Hugo, Paul, Max, Noé (décalage des formants et de la hauteur) | Apache-2.0 |
| Français (2) | Piper | gilles (données CC0), siwis-medium (CC BY 4.0) : **narration uniquement** | CC0 / CC BY 4.0 |

Les voix françaises « MLS » de Piper ont été testées puis écartées : elles sont trop peu compréhensibles (vérification par Whisper).
Les voix Piper ne savent pas prononcer un mot isolé, donc elles ne chantent pas.

**Le chant :** chaque mot est synthétisé, puis recalé sur la mélodie en hauteur et en durée par PSOLA (Praat).
Les voyelles sont étirées, une légère doublure et de la réverbération sont ajoutées. Les licences CC BY imposent de
**créditer** les voix : les crédits sont générés automatiquement dans la description de chaque vidéo.

## Installation

```bash
./setup.sh          # dépendances Python + modèles de voix (~700 Mo)
```

Outils nécessaires : Python 3.10+, Node 18+ avec Playwright (Chromium) et ffmpeg.

## Utilisation

```bash
# un épisode complet (22 à 27 min) en anglais
python3 make_episode.py --lang en --seed 12

# en français, durée imposée
python3 make_episode.py --lang fr --seed 7 --minutes 25

# le lot du jour : 1 épisode anglais + 1 français, seeds tirés de la date
python3 batch.py --count 2

# ... et publication sur une Release GitHub (nécessite gh authentifié)
python3 batch.py --count 2 --publish
```

Chaque épisode produit, dans `out/<langue>-<seed>/` :

- `episode.mp4` : la vidéo 1920×1080, 30 i/s, H.264 + AAC ;
- `thumbnail.jpg` : la miniature 1280×720 ;
- `metadata.json` et `description.txt` : titre, description avec **chapitres horodatés**, tags, catégorie, réglage « conçue pour les enfants » ;
- `timeline.json` et `audio.wav` : les fichiers intermédiaires.

Durée de calcul sur 4 cœurs CPU : environ 4 min pour l'audio, plus le rendu vidéo (voir la fin du fichier).

## Mettre en ligne sur YouTube

1. Téléverse `episode.mp4`, puis copie le titre et la description depuis `description.txt`.
2. Choisis la miniature `thumbnail.jpg`.
3. Coche **« Oui, elle est conçue pour les enfants »**. C'est obligatoire (loi COPPA).
4. Catégorie : Éducation. Langue : celle de l'épisode.
5. Contenu modifié ou synthétique : non requis pour de l'animation non réaliste. Tu peux quand même indiquer
   que les voix sont synthétiques.

**Conseils pour la monétisation (Programme Partenaire YouTube) :**

- Il faut 1 000 abonnés et 4 000 heures de visionnage sur 12 mois.
- YouTube refuse la monétisation du « contenu non authentique » : vidéos produites en masse, répétitives ou peu différenciées.
  Chaque épisode est différent (chansons, paroles, voix, décors et musique changent), mais **regarde chaque vidéo avant de la publier**,
  garde un rythme régulier (10 par semaine au maximum, réparties sur 2 chaînes) et soigne les titres et miniatures.
- Une vidéo pour enfants n'a pas de publicité personnalisée, donc elle rapporte moins par vue.

## Structure du code

```
make_episode.py      épisode complet (plan, audio, vidéo, miniature, métadonnées)
batch.py             lot d'épisodes + publication sur GitHub Releases
studio/voices.py     30 voix : parole (Kokoro / Piper) et chant (PSOLA)
studio/songs.py      mélodies du domaine public, paroles originales EN/FR, générateur de mélodies
studio/music.py      instruments synthétisés, accords automatiques, mixage, réverbération
studio/planner.py    plan de l'épisode : chansons, leçons, présentateur, minutage
render/core.js       personnages, costumes, fruits, formes, objets, textes
render/world.js      décors et véhicules
render/segments.js   rendu de chaque type de chanson et de leçon, karaoké, transitions
render/render.js     rendu parallèle (Chromium headless) puis ffmpeg
tools/               aperçus de rendu, classement de voix
```

## Automatisation (10 vidéos par semaine)

Une tâche planifiée Claude Code se lance **du lundi au vendredi à 2 h 17 (heure de Paris)**. Chaque session :

1. clone ce dépôt et lance `./setup.sh` ;
2. exécute `python3 batch.py --count 2`, soit **1 épisode anglais + 1 français** ;
3. **t'envoie les vidéos, les miniatures et les descriptions dans l'appli Claude**, avec une notification.

Cela fait 5 épisodes en anglais et 5 en français par semaine. Une session Claude ne peut pas créer de Release GitHub
(erreur 403) : les vidéos arrivent donc dans l'appli. `batch.py --publish` reste utilisable depuis ton ordinateur avec `gh`.
Regarde chaque épisode avant de le mettre en ligne : ce contrôle humain protège la monétisation.

Pour produire un gros lot d'un coup (reprise automatique après coupure) :

```bash
python3 tools/produce.py --en 1001-1015 --fr 2001-2015
```

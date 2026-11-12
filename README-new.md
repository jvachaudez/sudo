# SUDO 0.4.0 — application portable

Ce projet construit l’application SUDO sans intégrer les exercices. Les cours sont distribués dans une archive séparée que l’étudiant peut placer où il le souhaite, par exemple dans `Documents\SUDO\Exercises`.

```text
SUDO-v0.4.0/
├── build.sh
├── assets/
│   ├── sudo.ico
│   └── sudo.png
└── sudo-extension/
    ├── extension.js
    ├── package.json
    ├── scripts/package-vsix.sh
    └── vsix/
```

## Construire l’application

Prérequis Windows : Git Bash, `curl`, `jq`, `unzip` et 7-Zip (`7z` dans le `PATH`). N’utilisez pas WSL pour ce build.

```bash
chmod +x build.sh
./build.sh
```

Le résultat est créé dans `dist/SUDO.zip`. Décompressez-le dans un chemin court, par exemple `C:\SUDO`, puis lancez `Lancer-SUDO.bat`.

## Installer les cours

L’archive des cours est indépendante de l’application. L’étudiant peut la décompresser par exemple ici :

```text
Documents/
└── SUDO/
    └── Exercises/
        ├── Algorithmique-Python/
        └── Algorithmique-C/
```

Dans SUDO, cliquez sur **SUDO : ouvrir Exercises** dans la barre d’état ou sur l’icône de dossier de l’Explorateur. Sélectionnez soit le dossier `Exercises`, soit directement un dossier de cours.

Le dossier choisi apparaît dans l’Explorateur de gauche. SUDO recherche récursivement ses fichiers `exercise.json` et ouvre automatiquement le premier exercice. Le bouton **Changer d’exercice** permet ensuite d’en choisir un autre.

Lorsque l’étudiant ouvre un exercice :

- le fichier de départ est copié dans `MesSolutions` et ouvert à gauche, ou la solution existante est conservée ;
- le fichier Markdown déclaré dans `exercise.json` est chargé à droite ;
- le diagramme Mermaid correspondant est rendu dans ce même volet ;
- les tests Python ou C associés à cet exercice sont utilisés.

## Construire uniquement le VSIX

Le build complet télécharge Mermaid automatiquement. Pour construire uniquement l’extension :

```bash
mkdir -p sudo-extension/media
curl -fL "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js" \
  -o sudo-extension/media/mermaid.min.js
curl -fL "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/LICENSE" \
  -o sudo-extension/media/mermaid-LICENSE.txt
./sudo-extension/scripts/package-vsix.sh
```

Le résultat est `sudo-extension/dist/sudo-extension-0.4.0.vsix`.

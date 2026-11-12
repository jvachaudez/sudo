const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let current = null;
let panel = null;
let statusItem = null;

function findUp(start, child) {
  let directory = path.resolve(start);
  for (let i = 0; i < 7; i += 1) {
    const candidate = path.join(directory, child);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return null;
}

function pythonCommand(context) {
  const configured = vscode.workspace.getConfiguration('sudo').get('pythonPath', '').trim();
  const explicit = configured || process.env.SUDO_PYTHON;
  if (explicit) return explicit;

  const tools = findUp(context.extensionPath, path.join('tools', 'python'));
  if (tools) {
    const executable = path.join(tools, process.platform === 'win32' ? 'python.exe' : 'bin/python3');
    if (fs.existsSync(executable)) return executable;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

function gccCommand(context) {
  const configured = vscode.workspace.getConfiguration('sudo').get('gccPath', '').trim();
  const explicit = configured || process.env.SUDO_GCC;
  if (explicit) return explicit;

  const tools = findUp(context.extensionPath, path.join('tools', 'mingw64', 'bin'));
  if (tools) {
    const executable = path.join(tools, process.platform === 'win32' ? 'gcc.exe' : 'gcc');
    if (fs.existsSync(executable)) return executable;
  }
  return 'gcc';
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const output = [];
  let inCode = false;
  let code = [];
  let language = '';
  let listOpen = false;

  const closeList = () => {
    if (listOpen) output.push('</ul>');
    listOpen = false;
  };

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        const source = code.join('\n');
        if (language.toLowerCase() === 'mermaid') {
          output.push(`<pre class="mermaid">${escapeHtml(source)}</pre>`);
        } else {
          output.push(`<pre><code class="language-${escapeHtml(language)}">${escapeHtml(source)}</code></pre>`);
        }
        code = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
        language = line.slice(3).trim();
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (/^[-*]\s+/.test(line)) {
      if (!listOpen) output.push('<ul>');
      listOpen = true;
      output.push(`<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>`);
    } else if (!line.trim()) {
      closeList();
    } else {
      closeList();
      output.push(`<p>${inlineMarkdown(line)}</p>`);
    }
  }
  closeList();
  return output.join('\n');
}

function resultHtml(result) {
  if (!result) return '<p class="muted">Cliquez sur « Exécuter les tests ».</p>';
  if (result.error) return `<div class="error"><strong>Erreur d’exécution</strong><pre>${escapeHtml(result.error)}</pre></div>`;
  const tests = result.tests.map((test) => {
    const icon = test.status === 'passed' ? '✓' : '✗';
    const detail = test.message ? `<div class="detail">${escapeHtml(test.message)}</div>` : '';
    return `<li class="${test.status}"><span>${icon}</span><div><strong>${escapeHtml(test.name)}</strong>${detail}</div></li>`;
  }).join('');
  const complete = result.failed === 0;
  return `<div class="score ${complete ? 'success' : ''}">${result.passed} / ${result.passed + result.failed} tests réussis</div><ul class="tests">${tests}</ul>`;
}

function webviewHtml(webview, statement, result, mermaidUri) {
  const nonce = Math.random().toString(36).slice(2);
  return `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';">
<style>
body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);padding:18px;line-height:1.55}
h1{font-size:1.45rem;margin-top:0} h2{font-size:1.15rem;margin-top:1.5rem}
pre{background:var(--vscode-textCodeBlock-background);padding:12px;overflow:auto;border-radius:4px}
code{font-family:var(--vscode-editor-font-family)}
.mermaid{background:transparent;text-align:center}.mermaid svg{max-width:100%;height:auto}
.actions{display:flex;flex-wrap:wrap;gap:8px;position:sticky;top:0;padding:10px 0;background:var(--vscode-editor-background);z-index:2}
button{border:0;padding:8px 12px;cursor:pointer;border-radius:3px;background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
button:hover{background:var(--vscode-button-hoverBackground)} button.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
.score{margin-top:12px;padding:10px;background:var(--vscode-inputValidation-warningBackground);border-left:3px solid var(--vscode-inputValidation-warningBorder)}
.score.success{background:var(--vscode-testing-iconPassed);color:var(--vscode-editor-background);border:0}
.tests{list-style:none;padding:0}.tests li{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--vscode-panel-border)}
.passed>span{color:var(--vscode-testing-iconPassed)}.failed>span{color:var(--vscode-testing-iconFailed)}.detail,.muted{opacity:.8}.error{border-left:3px solid var(--vscode-testing-iconFailed);padding-left:10px}
</style></head><body>
<div class="actions"><button id="run">▶ Exécuter les tests</button><button id="choose" class="secondary">Changer d’exercice</button><button id="folder" class="secondary">Ouvrir un autre cours</button><button id="reset" class="secondary">Recommencer</button></div>
<main>${markdownToHtml(statement)}</main>
<h2>Résultats</h2><section>${resultHtml(result)}</section>
<script nonce="${nonce}">const vscode=acquireVsCodeApi();document.getElementById('run').addEventListener('click',()=>vscode.postMessage({command:'run'}));document.getElementById('choose').addEventListener('click',()=>vscode.postMessage({command:'choose'}));document.getElementById('folder').addEventListener('click',()=>vscode.postMessage({command:'folder'}));document.getElementById('reset').addEventListener('click',()=>vscode.postMessage({command:'reset'}));</script>
<script nonce="${nonce}" src="${mermaidUri}"></script>
<script nonce="${nonce}">
if(globalThis.mermaid){
  const darkMode=document.body.classList.contains('vscode-dark')||document.body.classList.contains('vscode-high-contrast');
  const themeVariables={nodeTextColor:'#000000'};
  if(darkMode){
    themeVariables.mainBkg='#f4f4f4';
    themeVariables.edgeLabelBackground='#f4f4f4';
  }
  mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:darkMode?'dark':'default',themeVariables});
  mermaid.run({querySelector:'.mermaid',suppressErrors:true}).catch((error)=>console.error('SUDO Mermaid:',error));
}
</script>
</body></html>`;
}

async function showPanel(context, result = null) {
  if (!current) return;
  if (!panel) {
    const mediaRoot = vscode.Uri.joinPath(context.extensionUri, 'media');
    panel = vscode.window.createWebviewPanel(
      'sudo.exercise',
      `Exercice · ${current.config.title}`,
      { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [mediaRoot] }
    );
    panel.onDidDispose(() => { panel = null; }, null, context.subscriptions);
    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.command === 'run') await runTests(context);
      if (message.command === 'choose') await chooseExercise(context);
      if (message.command === 'folder') await openExercisesFolder();
      if (message.command === 'reset') await resetExercise(context);
    }, null, context.subscriptions);
  }
  panel.title = `Exercice · ${current.config.title}`;
  const mermaidUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', 'mermaid.min.js')
  );
  panel.webview.html = webviewHtml(panel.webview, current.statement, result, mermaidUri);
  panel.reveal(vscode.ViewColumn.Two, true);
}

async function openExercise(context, exercise) {
  if (!exercise) return chooseExercise(context);
  const { directory, config, root, relativePath } = exercise;
  const statementFile = path.join(directory, config.statement);
  const starterFile = path.join(directory, config.starter);
  if (!fs.existsSync(statementFile) || !fs.existsSync(starterFile)) {
    throw new Error(`Fichiers manquants pour l’exercice « ${config.title} ».`);
  }
  const statement = fs.readFileSync(statementFile, 'utf8');
  const studentDirectory = path.join(root, 'MesSolutions', relativePath);
  fs.mkdirSync(studentDirectory, { recursive: true });
  const solution = path.join(studentDirectory, config.solution || 'solution.py');
  if (!fs.existsSync(solution)) fs.copyFileSync(starterFile, solution);

  current = { ...exercise, statement, solution };
  const document = await vscode.workspace.openTextDocument(solution);
  await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.One, preview: false });
  await showPanel(context);
  statusItem.command = 'sudo.chooseExercise';
  statusItem.text = `$(beaker) SUDO : ${config.title}`;
  statusItem.tooltip = relativePath;
  statusItem.show();
}

function scanExercises(root) {
  const found = [];
  const pending = [{ directory: root, depth: 0 }];
  while (pending.length) {
    const { directory, depth } = pending.pop();
    const configFile = path.join(directory, 'exercise.json');
    if (fs.existsSync(configFile)) {
      try {
        const config = readJson(configFile);
        if (config.title && config.language && config.statement && config.starter && config.tests) {
          found.push({
            id: String(config.id || path.basename(directory)),
            directory,
            root,
            relativePath: path.relative(root, directory) || String(config.id || path.basename(directory)),
            config
          });
        }
      } catch (error) {
        console.warn(`SUDO : exercise.json invalide dans ${directory}`, error);
      }
      continue;
    }
    if (depth >= 6) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'MesSolutions') continue;
      pending.push({ directory: path.join(directory, entry.name), depth: depth + 1 });
    }
  }
  return found;
}

function availableExercises() {
  const unique = new Map();
  for (const folder of vscode.workspace.workspaceFolders || []) {
    for (const exercise of scanExercises(folder.uri.fsPath)) unique.set(exercise.directory, exercise);
  }
  return [...unique.values()].sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath, 'fr') ||
    left.config.title.localeCompare(right.config.title, 'fr')
  );
}

async function openExercisesFolder() {
  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Ouvrir les exercices',
    title: 'SUDO · Choisir le dossier Exercises ou un dossier de cours'
  });
  if (selected?.[0]) await vscode.commands.executeCommand('vscode.openFolder', selected[0], false);
}

async function chooseExercise(context) {
  const exercises = availableExercises();
  if (!exercises.length) {
    const answer = await vscode.window.showInformationMessage(
      'SUDO ne trouve aucun exercice dans le dossier ouvert.',
      'Ouvrir le dossier Exercises'
    );
    if (answer) await openExercisesFolder();
    return;
  }
  const choices = exercises.map((exercise) => ({
    label: exercise.config.title,
    description: String(exercise.config.language || '').toUpperCase(),
    detail: exercise.relativePath,
    exercise
  }));
  const selected = await vscode.window.showQuickPick(choices, {
    title: 'SUDO · Choisir un exercice',
    placeHolder: 'Le Markdown et le diagramme s’adapteront à l’exercice choisi'
  });
  if (selected) await openExercise(context, selected.exercise);
}

function executeRaw(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ code: -1, stdout, stderr, error: 'Temps d’exécution dépassé.' });
    }, 10000);
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      finish({ code: -1, stdout, stderr, error: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      finish({ code, stdout, stderr });
    });
  });
}

function execute(command, args, cwd) {
  return executeRaw(command, args, cwd).then(({ stdout, stderr, error }) => {
      if (error) return { error };
      try {
        const lines = stdout.trim().split(/\r?\n/);
        return JSON.parse(lines.at(-1));
      } catch {
        return { error: stderr.trim() || stdout.trim() || 'Le moteur de tests n’a produit aucun résultat.' };
      }
  });
}

async function runCTests(context) {
  const testsFile = path.join(current.directory, current.config.tests);
  const executable = path.join(path.dirname(current.solution), 'sudo-tests.exe');
  const compilation = await executeRaw(
    gccCommand(context),
    ['-std=c11', '-Wall', '-Wextra', current.solution, testsFile, '-o', executable],
    current.directory
  );
  if (compilation.error || compilation.code !== 0) {
    return { error: compilation.error || compilation.stderr.trim() || 'La compilation C a échoué.' };
  }
  return execute(executable, [], path.dirname(current.solution));
}

async function runTests(context) {
  if (!current) {
    await chooseExercise(context);
    if (!current) return;
  }
  await vscode.workspace.saveAll(false);
  statusItem.text = '$(loading~spin) SUDO : tests en cours…';
  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'SUDO : exécution des tests', cancellable: false },
    () => {
      if (current.config.language === 'c') return runCTests(context);
      if (current.config.language === 'python') {
        const testsFile = path.join(current.directory, current.config.tests);
        return execute(pythonCommand(context), [testsFile, current.solution], current.directory);
      }
      return Promise.resolve({ error: `Langage non pris en charge : ${current.config.language}` });
    }
  );
  await showPanel(context, result);
  if (result && !result.error && result.failed === 0) {
    statusItem.text = '$(pass-filled) SUDO : exercice réussi';
    vscode.window.showInformationMessage(`Bravo ! ${result.passed} tests sur ${result.passed} réussis.`);
  } else {
    statusItem.text = '$(error) SUDO : à corriger';
  }
}

async function resetExercise(context) {
  if (!current) return chooseExercise(context);
  const answer = await vscode.window.showWarningMessage('Remplacer votre solution par le fichier de départ ?', { modal: true }, 'Recommencer');
  if (answer !== 'Recommencer') return;
  fs.copyFileSync(path.join(current.directory, current.config.starter), current.solution);
  const document = await vscode.workspace.openTextDocument(current.solution);
  await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.One, preview: false });
  await showPanel(context);
}

async function initialize(context) {
  const exercises = availableExercises();
  if (!exercises.length) {
    statusItem.command = 'sudo.openExercisesFolder';
    statusItem.text = '$(folder-opened) SUDO : ouvrir Exercises';
    statusItem.tooltip = 'Choisir le dossier Exercises ou un dossier de cours';
    statusItem.show();
    return;
  }
  statusItem.command = 'sudo.chooseExercise';
  statusItem.text = `$(list-selection) SUDO : ${exercises.length} exercice${exercises.length > 1 ? 's' : ''}`;
  statusItem.tooltip = 'Choisir un exercice';
  statusItem.show();
  if (vscode.workspace.getConfiguration('sudo').get('autoOpen', true)) {
    await openExercise(context, exercises[0]);
  }
}

function activate(context) {
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  context.subscriptions.push(
    statusItem,
    vscode.commands.registerCommand('sudo.openExercisesFolder', openExercisesFolder),
    vscode.commands.registerCommand('sudo.openExercise', () => chooseExercise(context)),
    vscode.commands.registerCommand('sudo.chooseExercise', () => chooseExercise(context)),
    vscode.commands.registerCommand('sudo.runTests', () => runTests(context)),
    vscode.commands.registerCommand('sudo.resetExercise', () => resetExercise(context)),
    vscode.workspace.onDidChangeWorkspaceFolders(() => initialize(context))
  );
  setTimeout(() => initialize(context).catch((error) => vscode.window.showErrorMessage(`SUDO : ${error.message}`)), 700);
}

function deactivate() {}

module.exports = { activate, deactivate };

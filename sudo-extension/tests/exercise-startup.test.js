const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function addExercise(root, folder, title, starter, statement) {
  const directory = path.join(root, folder);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'exercise.json'), JSON.stringify({
    id: folder, title, language: 'python', statement: 'exercise.md',
    starter: 'starter.py', solution: 'solution.py', tests: 'tests.py'
  }));
  fs.writeFileSync(path.join(directory, 'starter.py'), starter);
  fs.writeFileSync(path.join(directory, 'exercise.md'), statement);
}

function activateExtension(root, autoOpen = true) {
  const commands = new Map();
  const opened = [];
  const status = { show() {} };
  const panel = {
    webview: {
      cspSource: 'vscode-webview:',
      asWebviewUri: (uri) => uri.fsPath,
      onDidReceiveMessage() {}
    },
    onDidDispose() {},
    reveal() {}
  };
  let startup;
  let folderChanged;
  let quickPickCount = 0;
  const vscode = {
    Uri: { joinPath: (uri, ...parts) => ({ fsPath: path.join(uri.fsPath, ...parts) }) },
    ViewColumn: { One: 1, Two: 2 },
    StatusBarAlignment: { Left: 1 },
    commands: {
      registerCommand(name, callback) { commands.set(name, callback); return {}; }
    },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: root } }],
      getConfiguration: () => ({ get: (name, fallback) => name === 'autoOpen' ? autoOpen : fallback }),
      openTextDocument: async (file) => ({ fileName: file }),
      onDidChangeWorkspaceFolders(callback) { folderChanged = callback; return {}; }
    },
    window: {
      createStatusBarItem: () => status,
      createWebviewPanel: () => panel,
      showTextDocument: async (document, options) => { opened.push({ document, options }); },
      showQuickPick: async (choices) => { quickPickCount += 1; return choices[1]; },
      showErrorMessage: (message) => { throw new Error(message); }
    }
  };
  const extensionFile = path.join(__dirname, '..', 'extension.js');
  const sandbox = {
    module: { exports: {} },
    require: (name) => name === 'vscode' ? vscode : require(name),
    console,
    setTimeout: (callback) => { startup = callback(); }
  };
  vm.runInNewContext(fs.readFileSync(extensionFile, 'utf8'), sandbox, { filename: extensionFile });
  sandbox.module.exports.activate({
    extensionPath: path.dirname(extensionFile),
    extensionUri: { fsPath: path.dirname(extensionFile) },
    subscriptions: []
  });
  return { commands, opened, panel, status, startup, folderChanged, get quickPickCount() { return quickPickCount; } };
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sudo-startup-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('opens the first exercise and allows choosing another', async (t) => {
  const root = fixture(t);
  addExercise(root, '02-second', 'Deuxième', 'second starter', '# Énoncé deuxième');
  addExercise(root, '01-first', 'Premier', 'first starter', '# Énoncé premier');
  const app = activateExtension(root);
  await app.startup;

  const solution = path.join(root, 'MesSolutions', '01-first', 'solution.py');
  assert.equal(app.opened[0].document.fileName, solution);
  assert.equal(app.opened[0].options.viewColumn, 1);
  assert.equal(fs.readFileSync(solution, 'utf8'), 'first starter');
  assert.match(app.panel.webview.html, /Énoncé premier/);
  assert.equal(app.quickPickCount, 0);

  await app.commands.get('sudo.chooseExercise')();
  assert.equal(app.quickPickCount, 1);
  assert.equal(app.opened[1].document.fileName, path.join(root, 'MesSolutions', '02-second', 'solution.py'));
  assert.match(app.panel.webview.html, /Énoncé deuxième/);
});

test('preserves an existing solution on automatic opening', async (t) => {
  const root = fixture(t);
  addExercise(root, '01-first', 'Premier', 'starter', '# Énoncé');
  const solutionDir = path.join(root, 'MesSolutions', '01-first');
  fs.mkdirSync(solutionDir, { recursive: true });
  const solution = path.join(solutionDir, 'solution.py');
  fs.writeFileSync(solution, 'student work');
  const app = activateExtension(root);
  await app.startup;

  assert.equal(app.opened[0].document.fileName, solution);
  assert.equal(fs.readFileSync(solution, 'utf8'), 'student work');
  assert.match(app.panel.webview.html, /Énoncé/);
});

test('respects the option to disable automatic opening', async (t) => {
  const root = fixture(t);
  addExercise(root, '01-first', 'Premier', 'starter', '# Énoncé');
  const app = activateExtension(root, false);
  await app.startup;

  assert.equal(app.opened.length, 0);
  assert.equal(app.quickPickCount, 0);
  assert.equal(app.status.command, 'sudo.chooseExercise');
});

test('opens the first exercise after a workspace folder change', async (t) => {
  const root = fixture(t);
  const app = activateExtension(root);
  await app.startup;
  assert.equal(app.status.command, 'sudo.openExercisesFolder');

  addExercise(root, '01-first', 'Premier', 'starter', '# Énoncé');
  await app.folderChanged();
  assert.equal(app.opened[0].document.fileName, path.join(root, 'MesSolutions', '01-first', 'solution.py'));
  assert.match(app.panel.webview.html, /Énoncé/);
  assert.equal(app.quickPickCount, 0);
});

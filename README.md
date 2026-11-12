# SUDO

SUDO is a portable educational programming environment based on VSCodium. It includes Python, GCC/MinGW-w64, programming extensions, Mermaid rendering, and an exercise runner for Python and C.

The bundled Python packages include NumPy, Matplotlib, pandas, ipykernel, SciPy, SymPy, Pint, openpyxl, pytest, python-control (`control`), Seaborn, scikit-learn, TensorFlow, OpenCV (`opencv-python`), and Segno. TensorFlow significantly increases the download and application size; GPU support on Windows requires additional configuration.

The application and the course exercises are distributed separately. This allows teachers to update the application without deleting students' courses or solutions.

## Windows requirements

The build must be run on Windows from **Git Bash**, not from WSL.

Install the following tools before building SUDO:

1. [Git for Windows](https://git-scm.com/download/win), which provides Git Bash.
2. [7-Zip](https://www.7-zip.org/).
3. .NET Framework 4.5 or later, including its `v4.0.30319` C# compiler.
4. `jq`, available from the [official jq download page](https://jqlang.org/download/). On current Windows systems, it can be installed with:

   ```powershell
   winget install jqlang.jq
   ```

The following commands must be available from Git Bash:

```bash
git --version
curl --version
unzip -v
jq --version
7z
```

If Git Bash cannot find 7-Zip, add its installation directory to the current shell:

```bash
export PATH="$PATH:/c/Program Files/7-Zip"
```

Make sure `jq.exe` is also stored in a directory included in the Windows `PATH`.

PowerShell is used to verify administrator privileges and create the desktop shortcut. It is already included with supported Windows versions.

## Downloading the project

You can clone the GitLab repository:

```bash
git clone <YOUR-GITLAB-REPOSITORY-URL>
cd <YOUR-PROJECT-DIRECTORY>
```

Alternatively, download the project ZIP from GitLab and extract it to a short path, for example:

```text
C:\SUDO-Build
```

The directory containing `build.sh` must also contain `sudo-launcher.cs` and the `assets` and `sudo-extension` directories.

## Building and installing SUDO

Close SUDO and VSCodium before starting the build.

Open **Git Bash as Administrator**, navigate to the project directory, and run:

```bash
chmod +x build.sh
./build.sh
```

The build script:

1. removes the previous local `build` and `dist` directories;
2. downloads VSCodium, Python, GCC/MinGW-w64, and Mermaid;
3. builds and installs the SUDO extension;
4. creates `dist/SUDO.zip` and the self-extracting `dist/SUDO-Portable.exe`;
5. removes the previous `C:\Program Files\SUDO` installation, if present;
6. installs the new application in `C:\Program Files\SUDO`;
7. creates or replaces the public desktop shortcut `SUDO.lnk`.

The shortcut is normally created here:

```text
C:\Users\Public\Desktop\SUDO.lnk
```

It launches:

```text
C:\Program Files\SUDO\Lancer-SUDO.bat
```

and uses the following icon:

```text
C:\Program Files\SUDO\branding\sudo.ico
```

The shortcut is available to every user of the computer.

To create the application ZIP and portable executable without installing SUDO, run:

```bash
./build.sh --no-install
```

Run `dist/SUDO-Portable.exe` on a 64-bit Windows computer to use SUDO without installing it. It extracts the application into a temporary directory at each launch and normally removes it after SUDO closes. Extraction requires free disk space and may take a while. User settings and extensions are still stored in `%LOCALAPPDATA%\SUDO`, and course files remain wherever the student saved them. The portable launcher requires .NET Framework 4.5 or later. The generated executable is not code-signed, so Windows may display a security warning.

## Python environment detection

The build includes `assets/python-env-tools/pet.exe` in the Python Environments extension to identify the bundled interpreter. This Windows x64 binary was built from [Python Environment Tools](https://github.com/microsoft/python-environment-tools) commit `89bf1c02290e09413e745cbbb0194bc50491bf0d` (branch `release/2026.12`), using `cargo build --locked --release -p pet` for `x86_64-pc-windows-gnu`. Its MIT license and generated third-party notices are included beside the binary. The Python and Python Environments extensions are pinned to versions 2026.4.0 and 1.36.0 respectively for compatibility with this binary.

## User data

The application is installed in `Program Files`, but writable VSCodium data is stored separately for each Windows user:

```text
%LOCALAPPDATA%\SUDO\
├── extensions\
└── user-data\
```

Course files and student solutions are not stored inside the application directory and are therefore preserved when SUDO is reinstalled.

## Installing the exercises

Download the separate `SUDO-Exercises-*.zip` archive from the GitLab project or its Releases page.

Extract it inside the student's Documents directory, for example:

```text
Documents\SUDO\Exercises\
├── Algorithmique-Python\
│   └── 01-moyenne\
└── Algorithmique-C\
    └── 01-pgcd\
```

The `Exercises` directory may contain several course directories. It can be stored anywhere on the computer.

## Opening the exercises in SUDO

1. Launch SUDO from the desktop shortcut.
2. Click **SUDO: Open Exercises** in the status bar, or use the folder button in the Explorer view.
3. Select either the complete `Exercises` directory or one course directory inside it.
4. The first exercise in the list opens automatically. Use **Change exercise** in the statement panel to choose another.

SUDO displays the selected folder in the Explorer on the left. When an exercise is selected:

- its starter code opens in the editor, or its existing solution if the student has already started it;
- its corresponding Markdown statement opens in the right-hand panel;
- its Mermaid algorithm is rendered in that panel, with black text in flowchart boxes for readability;
- the associated Python or C tests are loaded;
- the student's work is saved under `MesSolutions` inside the opened course directory.

Use the **Run tests** button or press `Ctrl+Shift+Enter` to check the solution.

## Troubleshooting

### `7z: command not found`

Add 7-Zip to the Git Bash path:

```bash
export PATH="$PATH:/c/Program Files/7-Zip"
```

### Administrator error

Close the terminal and start Git Bash again with **Run as administrator**. Administrator privileges are required to write to `C:\Program Files` and the public desktop.

### VSCodium is still running

Close every SUDO or VSCodium window, then run `./build.sh` again.

### Windows reports that a path is too long

Move the source project to a shorter directory such as `C:\SUDO-Build`, then rebuild it.

## Distribution layout

SUDO uses two independent downloads:

- `SUDO-Application-*.zip`: application source and build system;
- `SUDO-Exercises-*.zip`: courses, statements, starter files, and tests.

Do not place the `Exercises` directory inside `C:\Program Files\SUDO`. Keep it in Documents or another student-writable directory.

using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Windows.Forms;

internal static class SudoLauncher
{
    private static readonly byte[] Marker = Encoding.ASCII.GetBytes("SUDO-SFX-1");

    [STAThread]
    private static int Main()
    {
        string temporary = Path.Combine(Path.GetTempPath(), "S-" + Guid.NewGuid().ToString("N").Substring(0, 12));
        Form splash = null;
        try
        {
            Application.EnableVisualStyles();
            splash = new Form { Text = "SUDO", Width = 380, Height = 120, StartPosition = FormStartPosition.CenterScreen, ControlBox = false };
            splash.Controls.Add(new Label { Text = "Préparation de SUDO en cours…", Dock = DockStyle.Fill, TextAlign = System.Drawing.ContentAlignment.MiddleCenter });
            splash.Show();
            splash.Refresh();
            Directory.CreateDirectory(temporary);
            string zip = Path.Combine(temporary, "SUDO.zip");
            using (FileStream input = File.OpenRead(Assembly.GetExecutingAssembly().Location))
            {
                if (input.Length < Marker.Length + sizeof(long)) throw new InvalidDataException("Archive SUDO absente.");
                input.Seek(-Marker.Length - sizeof(long), SeekOrigin.End);
                long length;
                using (BinaryReader reader = new BinaryReader(input, Encoding.UTF8, true))
                {
                    length = reader.ReadInt64();
                    byte[] marker = reader.ReadBytes(Marker.Length);
                    for (int i = 0; i < Marker.Length; i++)
                        if (marker[i] != Marker[i]) throw new InvalidDataException("Archive SUDO invalide.");
                }
                long offset = input.Length - Marker.Length - sizeof(long) - length;
                if (length <= 0 || offset < 0) throw new InvalidDataException("Taille de l’archive SUDO invalide.");
                input.Position = offset;
                using (FileStream output = File.Create(zip))
                {
                    byte[] buffer = new byte[1024 * 1024];
                    long remaining = length;
                    while (remaining > 0)
                    {
                        int count = input.Read(buffer, 0, (int)Math.Min(buffer.Length, remaining));
                        if (count == 0) throw new EndOfStreamException();
                        output.Write(buffer, 0, count);
                        remaining -= count;
                    }
                }
            }
            ZipFile.ExtractToDirectory(zip, temporary);
            File.Delete(zip);
            splash.Close();
            splash.Dispose();
            splash = null;
            string launcherPath = Path.Combine(temporary, "SUDO", "Lancer-SUDO.bat");
            ProcessStartInfo start = new ProcessStartInfo("cmd.exe", "/d /s /c \"\"" + launcherPath + "\" --wait\"");
            start.WorkingDirectory = Path.GetDirectoryName(launcherPath);
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            using (Process process = Process.Start(start))
            {
                process.WaitForExit();
                if (process.ExitCode != 0) throw new Exception("Le lanceur SUDO s’est terminé avec le code " + process.ExitCode + ".");
            }
            return 0;
        }
        catch (Exception error)
        {
            if (splash != null) { splash.Close(); splash.Dispose(); }
            MessageBox.Show("Impossible de lancer SUDO :\n\n" + error.Message, "SUDO", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
        finally
        {
            try { if (Directory.Exists(temporary)) Directory.Delete(temporary, true); }
            catch { }
        }
    }
}

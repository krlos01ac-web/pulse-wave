using System.Runtime.InteropServices;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace PulseWave;

public partial class Form1 : Form
{
    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);
    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;

    private readonly WebView2 webView;

    public Form1()
    {
        InitializeComponent();

        Text = "Pulse Wave";
        StartPosition = FormStartPosition.CenterScreen;
        Width = 1366;
        Height = 768;
        MinimumSize = new Size(960, 540);
        BackColor = Color.FromArgb(10, 12, 18);

        // Carrega o ícone oficial da janela e da barra de tarefas
        try
        {
            string iconPath = Path.Combine(AppContext.BaseDirectory, "icon.ico");
            if (File.Exists(iconPath))
            {
                Icon = new Icon(iconPath);
            }
        }
        catch
        {
            // Fallback silencioso se o arquivo de ícone não puder ser lido diretamente
        }

        webView = new WebView2
        {
            Dock = DockStyle.Fill,
            DefaultBackgroundColor = Color.FromArgb(10, 12, 18)
        };
        Controls.Add(webView);
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        try
        {
            int darkMode = 1;
            DwmSetWindowAttribute(Handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref darkMode, sizeof(int));
        }
        catch
        {
            // Silencioso em versões antigas do Windows
        }
    }

    protected override async void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        await InitializeWebViewAsync();
    }

    private async Task InitializeWebViewAsync()
    {
        string[] searchPaths = [
            Path.Combine(AppContext.BaseDirectory, "dist"),
            Path.Combine(AppContext.BaseDirectory, "..", "dist"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "dist"),
            @"e:\vizzy-engine\dist"
        ];

        string? distPath = searchPaths.FirstOrDefault(p => Directory.Exists(p) && File.Exists(Path.Combine(p, "index.html")));

        if (distPath == null)
        {
            MessageBox.Show(
                "A pasta 'dist' com os ficheiros compilados não foi encontrada.\nCertifique-se de executar 'npm run build' primeiro.",
                "Pulse Wave - Erro",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            return;
        }

        distPath = Path.GetFullPath(distPath);

        try
        {
            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "PulseWave"
            );

            var envOptions = new CoreWebView2EnvironmentOptions(
                "--enable-features=WebCodecs,CanvasOopRasterization " +
                "--enable-gpu-rasterization " +
                "--enable-zero-copy " +
                "--ignore-gpu-blocklist " +
                "--autoplay-policy=no-user-gesture-required"
            );

            var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder, envOptions);
            await webView.EnsureCoreWebView2Async(env);

            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            webView.CoreWebView2.Settings.AreDevToolsEnabled = true;
            webView.CoreWebView2.Settings.IsZoomControlEnabled = false;

            // Mapeamento de Host Virtual HTTPS para evitar problemas de CORS e manter contexto seguro para WebCodecs
            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "pulsewave.local",
                distPath,
                CoreWebView2HostResourceAccessKind.Allow
            );

            webView.CoreWebView2.Navigate("https://pulsewave.local/index.html");
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"Falha ao inicializar o motor de renderização WebView2:\n{ex.Message}",
                "Pulse Wave - Erro",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }
}

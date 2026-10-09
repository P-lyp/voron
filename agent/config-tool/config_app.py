import os
import sys
import threading
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from PIL import Image, ImageTk

# Resolve o caminho de assets de icones
def get_asset_path(filename):
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        bundle_path = os.path.join(sys._MEIPASS, 'assets', filename)
        if os.path.exists(bundle_path):
            return bundle_path

    base_dir = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(base_dir, "assets", filename),
        os.path.join(base_dir, "..", "assets", filename),
        os.path.join(base_dir, filename),
        os.path.join(base_dir, "..", filename),
        r"C:\Users\Felipe\Desktop\Programação\AI DB\agent\assets" + "\\" + filename,
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

# Resolve o caminho do arquivo .env
def get_env_path():
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))

    candidates = [
        os.path.join(base_dir, '.env'),
        os.path.join(base_dir, 'agent', '.env'),
        os.path.join(base_dir, '..', '.env'),
        os.path.join(base_dir, '..', 'agent', '.env'),
        r"C:\Users\Felipe\Desktop\Programação\AI DB\agent\.env",
    ]

    for p in candidates:
        norm = os.path.abspath(p)
        if os.path.exists(norm):
            return norm

    # Fallback padrão
    return os.path.abspath(candidates[0])

def load_env(filepath):
    config = {
        "FIREBIRD_HOST": "127.0.0.1",
        "FIREBIRD_PORT": "3050",
        "FIREBIRD_DATABASE": r"D:\TGA\Dados\R3\TGA.FDB",
        "FIREBIRD_USER": "SYSDBA",
        "FIREBIRD_PASSWORD": "masterkey",
        "COMPANY_ID": "empresa-piloto-001",
        "AGENT_TOKEN": "token-secreto-agente-001",
        "CLOUD_GATEWAY_URL": "wss://voronapi.onrender.com/agent-tunnel",
    }

    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#') or '=' not in line:
                        continue
                    key, val = line.split('=', 1)
                    config[key.strip()] = val.strip()
        except Exception as e:
            print(f"Erro ao ler .env: {e}")

    return config

def save_env(filepath, config):
    lines = [
        f"FIREBIRD_HOST={config.get('FIREBIRD_HOST', '127.0.0.1')}\n",
        f"FIREBIRD_PORT={config.get('FIREBIRD_PORT', '3050')}\n",
        f"FIREBIRD_DATABASE={config.get('FIREBIRD_DATABASE', '')}\n",
        f"FIREBIRD_USER={config.get('FIREBIRD_USER', 'SYSDBA')}\n",
        f"FIREBIRD_PASSWORD={config.get('FIREBIRD_PASSWORD', 'masterkey')}\n",
        "\n",
        f"COMPANY_ID={config.get('COMPANY_ID', 'empresa-piloto-001')}\n",
        f"AGENT_TOKEN={config.get('AGENT_TOKEN', 'token-secreto-agente-001')}\n",
        f"CLOUD_GATEWAY_URL={config.get('CLOUD_GATEWAY_URL', 'wss://voronapi.onrender.com/agent-tunnel')}\n",
    ]
    os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)

class ConfigApp(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("Voron - Agente Local (Configurações)")
        self.geometry("680x560")
        self.minsize(620, 520)

        self.env_path = get_env_path()
        self.config_data = load_env(self.env_path)

        self.setup_window_icon()
        self.setup_ui()

    def setup_window_icon(self):
        ico_path = get_asset_path("config_voron.ico")
        if ico_path and os.path.exists(ico_path):
            try:
                self.iconbitmap(default=ico_path)
            except Exception as e:
                pass

        png_path = get_asset_path("config_voron.png")
        if png_path and os.path.exists(png_path):
            try:
                img = Image.open(png_path).resize((64, 64), Image.Resampling.LANCZOS)
                self._app_icon_photo = ImageTk.PhotoImage(img)
                self.iconphoto(False, self._app_icon_photo)
            except Exception as e:
                pass

    def setup_ui(self):
        # Configurar estilos ttk
        style = ttk.Style(self)
        try:
            style.theme_use('clam')
        except:
            pass

        style.configure('TLabel', font=('Segoe UI', 9))
        style.configure('TEntry', font=('Segoe UI', 9))
        style.configure('TButton', font=('Segoe UI', 9))
        style.configure('Header.TLabel', font=('Segoe UI', 13, 'bold'), foreground='#0f3928')
        style.configure('SubHeader.TLabel', font=('Segoe UI', 8), foreground='#555555')
        style.configure('Section.TLabelframe.Label', font=('Segoe UI', 10, 'bold'), foreground='#1b4332')
        style.configure('Primary.TButton', font=('Segoe UI', 9, 'bold'), background='#0f3928', foreground='white')

        main_frame = ttk.Frame(self, padding="16 12 16 12")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Cabeçalho com Ícone Oficial Voron + Engrenagem
        header_frame = ttk.Frame(main_frame)
        header_frame.pack(fill=tk.X, pady=(0, 12))

        png_path = get_asset_path("config_voron.png")
        if png_path and os.path.exists(png_path):
            try:
                h_img = Image.open(png_path).resize((44, 44), Image.Resampling.LANCZOS)
                self._header_icon = ImageTk.PhotoImage(h_img)
                lbl_icon = ttk.Label(header_frame, image=self._header_icon)
                lbl_icon.pack(side=tk.LEFT, padx=(0, 12))
            except Exception:
                pass

        header_text_frame = ttk.Frame(header_frame)
        header_text_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        ttk.Label(header_text_frame, text="Configurações do Voron - Agente Local", style='Header.TLabel').pack(anchor='w')
        ttk.Label(
            header_text_frame,
            text=f"Arquivo de configuração ativo: {self.env_path}",
            style='SubHeader.TLabel'
        ).pack(anchor='w', pady=(2, 0))

        # Seção 1: Banco de Dados Firebird
        fb_frame = ttk.LabelFrame(main_frame, text="  Banco de Dados Firebird  ", padding="12 10 12 10", style='Section.TLabelframe')
        fb_frame.pack(fill=tk.X, pady=6)

        # Caminho do banco (.FDB ou .TGA)
        ttk.Label(fb_frame, text="Caminho do Banco (.FDB / .TGA):").grid(row=0, column=0, sticky='w', pady=4)
        path_box = ttk.Frame(fb_frame)
        path_box.grid(row=0, column=1, columnspan=3, sticky='ew', pady=4)

        self.var_db_path = tk.StringVar(value=self.config_data.get("FIREBIRD_DATABASE", ""))
        self.ent_db_path = ttk.Entry(path_box, textvariable=self.var_db_path)
        self.ent_db_path.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6))

        btn_browse = ttk.Button(path_box, text="Procurar...", command=self.browse_database)
        btn_browse.pack(side=tk.RIGHT)

        # Host e Porta
        ttk.Label(fb_frame, text="Host / IP:").grid(row=1, column=0, sticky='w', pady=4)
        self.var_host = tk.StringVar(value=self.config_data.get("FIREBIRD_HOST", "127.0.0.1"))
        self.ent_host = ttk.Entry(fb_frame, textvariable=self.var_host, width=22)
        self.ent_host.grid(row=1, column=1, sticky='w', pady=4)

        ttk.Label(fb_frame, text="Porta:").grid(row=1, column=2, sticky='e', padx=(16, 6), pady=4)
        self.var_port = tk.StringVar(value=self.config_data.get("FIREBIRD_PORT", "3050"))
        self.ent_port = ttk.Entry(fb_frame, textvariable=self.var_port, width=10)
        self.ent_port.grid(row=1, column=3, sticky='w', pady=4)

        # Usuário e Senha
        ttk.Label(fb_frame, text="Usuário:").grid(row=2, column=0, sticky='w', pady=4)
        self.var_user = tk.StringVar(value=self.config_data.get("FIREBIRD_USER", "SYSDBA"))
        self.ent_user = ttk.Entry(fb_frame, textvariable=self.var_user, width=22)
        self.ent_user.grid(row=2, column=1, sticky='w', pady=4)

        ttk.Label(fb_frame, text="Senha:").grid(row=2, column=2, sticky='e', padx=(16, 6), pady=4)
        self.var_pass = tk.StringVar(value=self.config_data.get("FIREBIRD_PASSWORD", "masterkey"))
        self.ent_pass = ttk.Entry(fb_frame, textvariable=self.var_pass, width=16, show="*")
        self.ent_pass.grid(row=2, column=3, sticky='w', pady=4)

        # Checkbox mostrar senha e Botão Testar Conexão
        tools_subframe = ttk.Frame(fb_frame)
        tools_subframe.grid(row=3, column=0, columnspan=4, sticky='ew', pady=(8, 2))

        self.var_show_pass = tk.BooleanVar(value=False)
        chk_show = ttk.Checkbutton(tools_subframe, text="Exibir senha", variable=self.var_show_pass, command=self.toggle_password)
        chk_show.pack(side=tk.LEFT)

        self.btn_test = ttk.Button(tools_subframe, text="Testar Conexão com o Banco", command=self.test_connection)
        self.btn_test.pack(side=tk.RIGHT)

        fb_frame.columnconfigure(1, weight=1)

        # Seção 2: Conexão Cloud / Empresa
        cloud_frame = ttk.LabelFrame(main_frame, text="  Conexão Cloud & Identificação  ", padding="12 10 12 10", style='Section.TLabelframe')
        cloud_frame.pack(fill=tk.X, pady=6)

        ttk.Label(cloud_frame, text="ID da Empresa:").grid(row=0, column=0, sticky='w', pady=4)
        self.var_company = tk.StringVar(value=self.config_data.get("COMPANY_ID", "empresa-piloto-001"))
        self.ent_company = ttk.Entry(cloud_frame, textvariable=self.var_company, width=35)
        self.ent_company.grid(row=0, column=1, sticky='w', pady=4)

        ttk.Label(cloud_frame, text="Token do Agente:").grid(row=1, column=0, sticky='w', pady=4)
        self.var_token = tk.StringVar(value=self.config_data.get("AGENT_TOKEN", "token-secreto-agente-001"))
        self.ent_token = ttk.Entry(cloud_frame, textvariable=self.var_token, width=35)
        self.ent_token.grid(row=1, column=1, sticky='w', pady=4)

        ttk.Label(cloud_frame, text="Gateway Nuvem:").grid(row=2, column=0, sticky='w', pady=4)
        self.var_gateway = tk.StringVar(value=self.config_data.get("CLOUD_GATEWAY_URL", "wss://voronapi.onrender.com/agent-tunnel"))
        self.ent_gateway = ttk.Entry(cloud_frame, textvariable=self.var_gateway)
        self.ent_gateway.grid(row=2, column=1, sticky='ew', pady=4)

        cloud_frame.columnconfigure(1, weight=1)

        # Status Banner
        self.lbl_status = ttk.Label(main_frame, text="Pronto para configurar.", font=('Segoe UI', 9, 'italic'), foreground='#333333')
        self.lbl_status.pack(fill=tk.X, pady=(10, 4))

        # Barra de Ações (Rodapé)
        footer_frame = ttk.Frame(main_frame)
        footer_frame.pack(fill=tk.X, side=tk.BOTTOM, pady=(8, 0))

        btn_cancel = ttk.Button(footer_frame, text="Fechar", command=self.destroy)
        btn_cancel.pack(side=tk.LEFT)

        btn_save = ttk.Button(footer_frame, text="Salvar Configurações", command=self.save_settings)
        btn_save.pack(side=tk.RIGHT)

    def toggle_password(self):
        if self.var_show_pass.get():
            self.ent_pass.config(show="")
        else:
            self.ent_pass.config(show="*")

    def browse_database(self):
        initial_dir = os.path.dirname(self.var_db_path.get()) if self.var_db_path.get() else "C:\\"
        filename = filedialog.askopenfilename(
            title="Selecione o arquivo do banco de dados Firebird",
            initialdir=initial_dir,
            filetypes=[
                ("Bancos Firebird / TGA", "*.fdb;*.tga;*.gdb"),
                ("Firebird Database (*.fdb)", "*.fdb"),
                ("TGA Database (*.tga)", "*.tga"),
                ("Todos os arquivos (*.*)", "*.*")
            ]
        )
        if filename:
            # Normalizar para barras do Windows
            self.var_db_path.set(os.path.normpath(filename))
            self.lbl_status.config(text=f"Banco selecionado: {filename}", foreground='#0055aa')

    def test_connection(self):
        self.btn_test.config(state=tk.DISABLED)
        self.lbl_status.config(text="Testando conexão com o Firebird...", foreground='#885500')

        db_path = self.var_db_path.get().strip()
        host = self.var_host.get().strip()
        port = self.var_port.get().strip()
        user = self.var_user.get().strip()
        password = self.var_pass.get().strip()

        def run_test():
            try:
                from firebird.driver import connect
                dsn = f"{host}/{port}:{db_path.replace(chr(92), '/')}"
                with connect(dsn, user=user, password=password) as con:
                    cur = con.cursor()
                    cur.execute("SELECT COUNT(*), MAX(DATAEMISSAO) FROM TMOV WHERE STATUS <> 'C'")
                    row = cur.fetchone()
                    count_sales = row[0] if row else 0
                    last_date = row[1].strftime('%d/%m/%Y') if (row and row[1]) else 'N/A'

                    msg = f"Conexão estabelecida com sucesso!\n\n• Vendas ativas encontradas: {count_sales:,}\n• Data da última emissão: {last_date}"
                    self.after(0, lambda: self.show_test_success(msg, count_sales, last_date))
            except Exception as e:
                err_msg = str(e)
                self.after(0, lambda: self.show_test_error(err_msg))

        threading.Thread(target=run_test, daemon=True).start()

    def show_test_success(self, msg, count, last_date):
        self.btn_test.config(state=tk.NORMAL)
        self.lbl_status.config(text=f"Conexão bem-sucedida! Última venda: {last_date} ({count:,} registros).", foreground='#0f763e')
        messagebox.showinfo("Sucesso na Conexão", msg)

    def show_test_error(self, err_msg):
        self.btn_test.config(state=tk.NORMAL)
        self.lbl_status.config(text="Falha na conexão com o banco de dados.", foreground='#cc0000')
        messagebox.showerror("Erro de Conexão", f"Não foi possível conectar ao Firebird:\n\n{err_msg}\n\nVerifique se o caminho do arquivo, host, porta e credenciais estão corretos.")

    def save_settings(self):
        db_path = self.var_db_path.get().strip()
        if not db_path:
            messagebox.showwarning("Aviso", "O caminho do banco de dados não pode ficar vazio.")
            return

        gw_url = self.var_gateway.get().strip()
        if gw_url.startswith("ws://") and not any(h in gw_url for h in ["localhost", "127.0.0.1"]):
            gw_url = "wss://" + gw_url[5:]
        elif gw_url.startswith("wss://") and any(h in gw_url for h in ["localhost", "127.0.0.1"]):
            gw_url = "ws://" + gw_url[6:]

        new_config = {
            "FIREBIRD_HOST": self.var_host.get().strip(),
            "FIREBIRD_PORT": self.var_port.get().strip(),
            "FIREBIRD_DATABASE": db_path,
            "FIREBIRD_USER": self.var_user.get().strip(),
            "FIREBIRD_PASSWORD": self.var_pass.get().strip(),
            "COMPANY_ID": self.var_company.get().strip(),
            "AGENT_TOKEN": self.var_token.get().strip(),
            "CLOUD_GATEWAY_URL": gw_url,
        }

        try:
            save_env(self.env_path, new_config)
            self.lbl_status.config(text="Configurações salvas com sucesso!", foreground='#0f763e')

            # Reinicia processos do agente em segundo plano para recarregar o novo .env imediatamente
            try:
                import subprocess
                ps_cmd = (
                    "Get-WmiObject Win32_Process -Filter \"Name = 'node.exe'\" -ErrorAction SilentlyContinue | "
                    "Where-Object { $_.CommandLine -like '*dist*agent*index.js*' -or $_.CommandLine -like '*src*index.ts*' } | "
                    "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
                )
                subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000))
            except:
                pass

            messagebox.showinfo(
                "Configurações Salvas",
                f"As configurações foram gravadas com sucesso no arquivo:\n{self.env_path}\n\nO Agente Local foi reiniciado para aplicar os novos parâmetros imediatamente."
            )
        except Exception as e:
            messagebox.showerror("Erro ao Salvar", f"Não foi possível salvar o arquivo:\n{e}")

if __name__ == "__main__":
    app = ConfigApp()
    app.mainloop()

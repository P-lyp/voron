import os
import sys
import time
import json
import shutil
import urllib.request
import subprocess
import threading
from PIL import Image, ImageDraw
import pystray
from pystray import MenuItem as item, Menu

def get_base_dirs():
    if getattr(sys, 'frozen', False):
        exe_dir = os.path.dirname(sys.executable)
    else:
        exe_dir = os.path.dirname(os.path.abspath(__file__))

    candidates = [
        exe_dir,
        os.path.join(exe_dir, 'agent'),
        os.path.join(exe_dir, '..'),
        os.path.join(exe_dir, '..', 'agent'),
        r"C:\Users\Felipe\Desktop\Programação\AI DB\agent"
    ]
    agent_dir = exe_dir
    for c in candidates:
        norm = os.path.abspath(c)
        if os.path.exists(os.path.join(norm, '.env')) or os.path.exists(os.path.join(norm, 'AI-DB-Agent-Service.xml')):
            agent_dir = norm
            break

    return exe_dir, agent_dir

EXE_DIR, AGENT_DIR = get_base_dirs()
LOGS_DIR = os.path.join(AGENT_DIR, "logs")
os.makedirs(LOGS_DIR, exist_ok=True)

# Proteção contra sys.stdout/stderr None em builds --noconsole do PyInstaller
TRAY_LOG_PATH = os.path.join(LOGS_DIR, "tray.log")
try:
    _tray_log = open(TRAY_LOG_PATH, "a", encoding="utf-8")
    if sys.stdout is None:
        sys.stdout = _tray_log
    if sys.stderr is None:
        sys.stderr = _tray_log
except:
    pass

SERVICE_EXE = os.path.join(AGENT_DIR, "AI-DB-Agent-Service.exe")

import traceback

def log_tray(msg):
    try:
        timestamp = time.strftime('%d/%m/%Y %H:%M:%S')
        with open(TRAY_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] {msg}\n")
            f.flush()
    except:
        pass

def handle_exception(exc_type, exc_value, exc_tb):
    err = "".join(traceback.format_exception(exc_type, exc_value, exc_tb))
    log_tray(f"CRITICAL UNHANDLED EXCEPTION:\n{err}")

sys.excepthook = handle_exception

def find_node_executable():
    node_path = shutil.which("node")
    if node_path and os.path.exists(node_path):
        return node_path

    defaults = [
        r"C:\Program Files\nodejs\node.exe",
        r"C:\Program Files (x86)\nodejs\node.exe",
        os.path.expandvars(r"%APPDATA%\npm\node.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\node\node.exe"),
    ]
    for d in defaults:
        if os.path.exists(d):
            return d

    return "node"

def find_python_gui_executable():
    """
    Localiza o interpretador Python para aplicações com interface gráfica (pythonw.exe).
    Garante que nenhuma janela de console/cmd seja aberta em segundo plano.
    """
    # Se estiver rodando como script Python (não PyInstaller congelado)
    if not getattr(sys, 'frozen', False) and sys.executable:
        cand = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
        if os.path.exists(cand):
            return cand

    # Procura via PATH
    cand = shutil.which("pythonw.exe") or shutil.which("pythonw")
    if cand and os.path.exists(cand):
        return cand

    # Locais padrões de instalação do Python no Windows
    known_paths = [
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Python\Python313\pythonw.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Python\Python312\pythonw.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Python\Python311\pythonw.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Python\Python310\pythonw.exe"),
        r"C:\Python313\pythonw.exe",
        r"C:\Python312\pythonw.exe",
        r"C:\Python311\pythonw.exe",
        r"C:\Python310\pythonw.exe",
    ]
    for kp in known_paths:
        if os.path.exists(kp):
            return kp

    # Fallback seguro
    return shutil.which("python.exe") or shutil.which("python") or "pythonw"

def launch_gui_process(cmd_args, cwd=None):
    """
    Executa um aplicativo GUI garantindo que nenhuma janela de console
    (cmd / conhost / terminal) seja exibida ou deixada em segundo plano.
    """
    kwargs = {}
    if sys.platform == "win32":
        kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
        si = subprocess.STARTUPINFO()
        si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        si.wShowWindow = 0  # SW_HIDE
        kwargs["startupinfo"] = si
    if cwd:
        kwargs["cwd"] = cwd
    return subprocess.Popen(cmd_args, **kwargs)

def load_agent_env():
    env_file = os.path.join(AGENT_DIR, ".env")
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
    if os.path.exists(env_file):
        try:
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        config[k.strip()] = v.strip().strip('"').strip("'")
        except Exception as e:
            log_tray(f"Erro ao ler .env: {e}")

    gw = config.get("CLOUD_GATEWAY_URL", "")
    if gw.startswith("ws://") and not any(h in gw for h in ["localhost", "127.0.0.1"]):
        config["CLOUD_GATEWAY_URL"] = "wss://" + gw[5:]
    elif gw.startswith("wss://") and any(h in gw for h in ["localhost", "127.0.0.1"]):
        config["CLOUD_GATEWAY_URL"] = "ws://" + gw[6:]

    return config

_ICON_CACHE = {}

def get_asset_path(filename):
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        bundle_path = os.path.join(sys._MEIPASS, 'assets', filename)
        if os.path.exists(bundle_path):
            return bundle_path

    candidates = [
        os.path.join(AGENT_DIR, "assets", filename),
        os.path.join(EXE_DIR, "assets", filename),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", filename),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", filename),
        os.path.join(AGENT_DIR, filename),
        os.path.join(EXE_DIR, filename),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

def create_fallback_voron_icon(color="green"):
    width = 64
    height = 64
    image = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    dc = ImageDraw.Draw(image)

    # Squircle branco com borda
    dc.rounded_rectangle((2, 2, 61, 61), radius=15, fill="#ffffff", outline="#cbd5e1", width=2)
    # Silhueta representativa do corvo
    dc.ellipse((14, 12, 48, 52), fill="#06261c")
    dc.polygon([(40, 20), (54, 25), (42, 33)], fill="#06261c")
    dc.ellipse((28, 18, 33, 23), fill="#ffffff")

    # Status badge no canto inferior direito
    badge_colors = {
        "green": "#16a34a",
        "yellow": "#f59e0b",
        "red": "#dc2626"
    }
    b_fill = badge_colors.get(color, "#16a34a")
    dc.ellipse((38, 38, 62, 62), fill=b_fill, outline="#ffffff", width=2)
    return image

def get_tray_icon(color="green"):
    global _ICON_CACHE
    if color in _ICON_CACHE:
        return _ICON_CACHE[color]

    icon_filenames = {
        "green": ["voron_tray_online_64.png", "voron_tray_online.png"],
        "yellow": ["voron_tray_warning_64.png", "voron_tray_warning.png"],
        "red": ["voron_tray_offline_64.png", "voron_tray_offline.png"],
    }

    files = icon_filenames.get(color, icon_filenames["green"])
    for f in files:
        p = get_asset_path(f)
        if p and os.path.exists(p):
            try:
                img = Image.open(p).convert("RGBA")
                _ICON_CACHE[color] = img
                return img
            except Exception as e:
                log_tray(f"Erro ao carregar icone {p}: {e}")

    img = create_fallback_voron_icon(color)
    _ICON_CACHE[color] = img
    return img

def create_circle_icon(color="green"):
    return get_tray_icon(color)

class AgentTrayApp:
    def __init__(self):
        self.status = "Iniciando..."
        self.is_connected = False
        self.is_process_running = False
        self.is_service_installed = False
        self.is_backend_reachable = False
        self.backend_url = "http://localhost:3001"
        self.has_local_backend = os.path.exists(os.path.join(AGENT_DIR, "..", "backend", "src", "server.ts"))
        self.icon = None
        self.local_proc = None
        self._stop_event = threading.Event()
        self._log_file_handle = None

    def run_command(self, cmd_args):
        try:
            res = subprocess.run(
                cmd_args,
                cwd=AGENT_DIR,
                capture_output=True,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            return res.returncode == 0, res.stdout, res.stderr
        except Exception as e:
            return False, "", str(e)

    def is_windows_service_active(self):
        try:
            ok, out, _ = self.run_command(["sc.exe", "query", "AIDBAgentService"])
            if ok and "RUNNING" in out:
                return True, True
            elif ok and ("STOP" in out or "PAUSED" in out):
                return True, False
        except:
            pass

        return False, False

    def kill_stray_agent_processes(self):
        try:
            ps_cmd = (
                "Get-WmiObject Win32_Process -Filter \"Name = 'node.exe'\" -ErrorAction SilentlyContinue | "
                "Where-Object { $_.CommandLine -like '*dist*agent*index.js*' -or $_.CommandLine -like '*src*index.ts*' } | "
                "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
            )
            subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
        except Exception as e:
            log_tray(f"Aviso ao limpar processos órfãos: {e}")

    def start_local_process(self):
        if self.local_proc and self.local_proc.poll() is None:
            return True

        self.kill_stray_agent_processes()

        node_bin = find_node_executable()
        script_candidates = [
            os.path.join(AGENT_DIR, "dist", "agent", "src", "index.js"),
            os.path.join(AGENT_DIR, "dist", "src", "index.js"),
            os.path.join(AGENT_DIR, "dist", "index.js"),
        ]
        target_script = None
        for cand in script_candidates:
            if os.path.exists(cand):
                target_script = cand
                break

        script_ts = os.path.join(AGENT_DIR, "src", "index.ts")

        if target_script:
            cmd = [node_bin, target_script]
        elif os.path.exists(script_ts):
            cmd = ["npx", "tsx", script_ts]
        else:
            log_tray(f"Erro: nenhum script encontrado em {script_candidates}")
            return False

        log_path = os.path.join(LOGS_DIR, "agent.log")
        try:
            if self._log_file_handle:
                try: self._log_file_handle.close()
                except: pass

            self._log_file_handle = open(log_path, "a", encoding="utf-8")
            self._log_file_handle.write(f"\n--- Sessão Iniciada pelo AgentTray ({time.strftime('%d/%m/%Y %H:%M:%S')}) ---\n")
            self._log_file_handle.flush()

            env = os.environ.copy()
            # Garante que NODE_ENV e variáveis do .env estejam presentes
            cfg = load_agent_env()
            env.update(cfg)

            self.local_proc = subprocess.Popen(
                cmd,
                cwd=AGENT_DIR,
                stdout=self._log_file_handle,
                stderr=subprocess.STDOUT,
                env=env,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            log_tray(f"Agente iniciado em segundo plano (PID: {self.local_proc.pid}, CMD: {' '.join(cmd)})")
            return True
        except Exception as e:
            log_tray(f"Falha ao disparar processo do agente: {e}")
            return False

    def stop_local_process(self):
        if self.local_proc and self.local_proc.poll() is None:
            log_tray(f"Encerrando processo local do agente (PID: {self.local_proc.pid})...")
            try:
                self.local_proc.terminate()
                self.local_proc.wait(timeout=3)
            except:
                try:
                    self.local_proc.kill()
                except:
                    pass
        self.local_proc = None
        self.kill_stray_agent_processes()
        if self._log_file_handle:
            try:
                self._log_file_handle.close()
            except:
                pass
            self._log_file_handle = None

    def check_backend_online(self):
        config = load_agent_env()
        company_id = config.get("COMPANY_ID", "empresa-piloto-001")
        gateway_url = config.get("CLOUD_GATEWAY_URL", "wss://voronapi.onrender.com/agent-tunnel").strip()

        if gateway_url.startswith("ws://") and not any(h in gateway_url for h in ["localhost", "127.0.0.1"]):
            gateway_url = "wss://" + gateway_url[5:]
        elif gateway_url.startswith("wss://") and any(h in gateway_url for h in ["localhost", "127.0.0.1"]):
            gateway_url = "ws://" + gateway_url[6:]

        http_url = gateway_url.replace("wss://", "https://").replace("ws://", "http://")
        if "/agent-tunnel" in http_url:
            base_url = http_url.split("/agent-tunnel")[0]
        else:
            base_url = "http://localhost:3001" if "localhost" in gateway_url or "127.0.0.1" in gateway_url else "https://voronapi.onrender.com"

        status_url = f"{base_url}/api/status?companyId={company_id}"

        backend_reachable = False
        tunnel_online = False
        try:
            req = urllib.request.Request(status_url, headers={'User-Agent': 'AgentTray/1.0'})
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                if resp.status == 200:
                    backend_reachable = True
                    data = json.loads(resp.read().decode('utf-8'))
                    tunnel_online = bool(data.get("serverLocalOnline"))
        except:
            backend_reachable = False

        return tunnel_online, backend_reachable, base_url

    def refresh_status(self):
        is_svc_installed, is_svc_running = self.is_windows_service_active()
        self.is_service_installed = is_svc_installed

        is_proc_alive = (self.local_proc is not None and self.local_proc.poll() is None)
        self.is_process_running = is_svc_running or is_proc_alive

        # Se o serviço Windows não estiver ativo, garante que o processo local supervisionado esteja rodando
        if not is_svc_running and not is_proc_alive and not self._stop_event.is_set():
            self.start_local_process()
            is_proc_alive = (self.local_proc is not None and self.local_proc.poll() is None)
            self.is_process_running = is_proc_alive

        # Confirmação real de túnel WebSocket com o Backend
        tunnel_online, backend_reachable, base_url = self.check_backend_online()
        self.is_connected = tunnel_online
        self.is_backend_reachable = backend_reachable
        self.backend_url = base_url

        if self.is_connected:
            self.status = "Online (Túnel Conectado)"
            icon_color = "green"
        elif not self.is_process_running:
            self.status = "Desconectado (Agente Parado)"
            icon_color = "red"
        elif not backend_reachable:
            self.status = "Backend Inalcançável (Offline)"
            icon_color = "yellow"
        else:
            self.status = "Conectando Túnel WebSocket..."
            icon_color = "yellow"

        if self.icon:
            try:
                self.icon.icon = get_tray_icon(icon_color)
                if not backend_reachable and self.is_process_running:
                    self.icon.title = f"Voron: Backend Inalcançável ({base_url})"
                else:
                    self.icon.title = f"Voron: {self.status}"
            except:
                pass

    def status_poll_loop(self):
        while not self._stop_event.is_set():
            try:
                self.refresh_status()
            except Exception as e:
                log_tray(f"Erro no poll de status: {e}")
            time.sleep(3)

    def open_config(self, icon=None, item=None):
        is_frozen = getattr(sys, 'frozen', False)
        config_candidates = []

        if is_frozen:
            # Em modo compilado (VoronTray.exe), prioriza o executável compilado
            config_candidates.extend([
                os.path.join(EXE_DIR, "ConfigVoron.exe"),
                os.path.join(AGENT_DIR, "ConfigVoron.exe"),
                os.path.join(AGENT_DIR, "..", "ConfigVoron.exe"),
                os.path.join(EXE_DIR, "ConfigAgente.exe"),
                os.path.join(AGENT_DIR, "ConfigAgente.exe"),
                os.path.join(AGENT_DIR, "..", "ConfigAgente.exe"),
                os.path.join(AGENT_DIR, "config-tool", "config_app.py"),
                os.path.join(EXE_DIR, "config-tool", "config_app.py"),
            ])
        else:
            # Em modo de desenvolvimento Python, prioriza o script para refletir alterações
            config_candidates.extend([
                os.path.join(AGENT_DIR, "config-tool", "config_app.py"),
                os.path.join(EXE_DIR, "config-tool", "config_app.py"),
                os.path.join(EXE_DIR, "ConfigVoron.exe"),
                os.path.join(AGENT_DIR, "ConfigVoron.exe"),
                os.path.join(AGENT_DIR, "..", "ConfigVoron.exe"),
                os.path.join(EXE_DIR, "ConfigAgente.exe"),
                os.path.join(AGENT_DIR, "ConfigAgente.exe"),
                os.path.join(AGENT_DIR, "..", "ConfigAgente.exe"),
            ])

        for c in config_candidates:
            norm = os.path.abspath(c)
            if os.path.exists(norm):
                log_tray(f"Abrindo configurador: {norm}")
                target_dir = os.path.dirname(norm)
                if norm.endswith(".exe"):
                    launch_gui_process([norm], cwd=target_dir)
                else:
                    pyw = find_python_gui_executable()
                    log_tray(f"Executando script via interpretador GUI: {pyw}")
                    launch_gui_process([pyw, norm], cwd=target_dir)
                return

        log_tray("Nenhum executável ou script de configuração foi localizado.")
        if self.icon:
            self.icon.notify("Configurador (ConfigVoron) não localizado.", "Aviso")

    def open_logs(self, icon=None, item=None):
        log_files = [
            os.path.join(LOGS_DIR, "agent.log"),
            os.path.join(LOGS_DIR, "AIDBAgentService.out.log"),
            os.path.join(AGENT_DIR, "AI-DB-Agent-Service.out.log"),
        ]
        target_log = None
        for lf in log_files:
            if os.path.exists(lf):
                target_log = lf
                break

        if not target_log:
            target_log = os.path.join(LOGS_DIR, "agent.log")
            with open(target_log, "w", encoding="utf-8") as f:
                f.write("Log do Agente Local AI DB iniciado.\n")

        subprocess.Popen(["notepad.exe", target_log])

    def test_database(self, icon=None, item=None):
        if self.icon:
            self.icon.notify("Verificando conexão com o Firebird...", "Diagnóstico")

        def run_test():
            try:
                from firebird.driver import connect
                cfg = load_agent_env()
                db_path = cfg.get("FIREBIRD_DATABASE", r"D:\TGA\Dados\R3\TGA.FDB")
                user = cfg.get("FIREBIRD_USER", "SYSDBA")
                password = cfg.get("FIREBIRD_PASSWORD", "masterkey")
                host = cfg.get("FIREBIRD_HOST", "127.0.0.1")

                dsn = f"{host}:{db_path.replace(chr(92), '/')}"
                with connect(dsn, user=user, password=password) as con:
                    cur = con.cursor()
                    cur.execute("SELECT COUNT(*), MAX(DATAEMISSAO) FROM TMOV WHERE STATUS <> 'C'")
                    row = cur.fetchone()
                    total = row[0] if row else 0
                    last_date = row[1].strftime('%d/%m/%Y') if (row and row[1]) else 'N/A'
                    if self.icon:
                        self.icon.notify(f"Conexão OK! {total:,} vendas cadastradas. Última emissão em {last_date}.", "Firebird Conectado")
            except Exception as e:
                if self.icon:
                    self.icon.notify(f"Erro ao conectar no banco:\n{e}", "Falha de Conexão")

        threading.Thread(target=run_test, daemon=True).start()

    def test_backend(self, icon=None, item=None):
        if self.icon:
            self.icon.notify("Verificando conexão com o Gateway/Backend...", "Diagnóstico")

        def run_test():
            tunnel_online, backend_reachable, base_url = self.check_backend_online()
            if not backend_reachable:
                msg = f"Backend INALCANÇÁVEL em:\n{base_url}\n\nO servidor na porta 3001 ou nuvem não está respondendo. Certifique-se de que o backend está em execução."
                title = "Backend Inalcançável"
            elif not tunnel_online:
                msg = f"Backend online em {base_url}, mas o Túnel WebSocket do agente ainda não conectou.\nAguarde alguns segundos ou clique em 'Reiniciar Agente'."
                title = "Túnel Conectando..."
            else:
                msg = f"Túnel WebSocket 100% OPERACIONAL!\nComunicação bidirecional com {base_url} confirmada."
                title = "Túnel Online (OK)"

            if self.icon:
                self.icon.notify(msg, title)

        threading.Thread(target=run_test, daemon=True).start()

    def start_backend_dev(self, icon=None, item=None):
        backend_dir = os.path.abspath(os.path.join(AGENT_DIR, "..", "backend"))
        if os.path.exists(backend_dir):
            try:
                subprocess.Popen(["cmd.exe", "/c", "npm run dev"], cwd=backend_dir, creationflags=subprocess.CREATE_NEW_CONSOLE)
                if self.icon:
                    self.icon.notify("Iniciando backend em nova janela do console...", "Backend Dev")
            except Exception as e:
                if self.icon:
                    self.icon.notify(f"Erro ao iniciar backend: {e}", "Erro")

    def restart_agent(self, icon=None, item=None):
        is_svc_installed, is_svc_running = self.is_windows_service_active()
        if is_svc_running:
            if os.path.exists(SERVICE_EXE):
                self.run_command([SERVICE_EXE, "restart"])
            else:
                self.run_command(["sc.exe", "stop", "AIDBAgentService"])
                time.sleep(2)
                self.run_command(["sc.exe", "start", "AIDBAgentService"])
        else:
            self.stop_local_process()
            time.sleep(1)
            self.start_local_process()

        time.sleep(2)
        self.refresh_status()

    def start_agent(self, icon=None, item=None):
        is_svc_installed, _ = self.is_windows_service_active()
        if is_svc_installed:
            if os.path.exists(SERVICE_EXE):
                self.run_command([SERVICE_EXE, "start"])
            else:
                self.run_command(["sc.exe", "start", "AIDBAgentService"])
        else:
            self.start_local_process()

        time.sleep(2)
        self.refresh_status()

    def stop_agent(self, icon=None, item=None):
        is_svc_installed, is_svc_running = self.is_windows_service_active()
        if is_svc_running:
            if os.path.exists(SERVICE_EXE):
                self.run_command([SERVICE_EXE, "stop"])
            else:
                self.run_command(["sc.exe", "stop", "AIDBAgentService"])
        else:
            self.stop_local_process()

        time.sleep(1)
        self.refresh_status()

    def install_windows_service(self, icon=None, item=None):
        batch_path = os.path.join(AGENT_DIR, "instalar-servico.bat")
        if os.path.exists(batch_path):
            try:
                subprocess.Popen(["powershell", "-Command", f'Start-Process "{batch_path}" -Verb RunAs'])
            except Exception as e:
                if self.icon:
                    self.icon.notify(f"Erro ao disparar instalador: {e}", "Erro")
        time.sleep(2)
        self.refresh_status()

    def quit_app(self, icon=None, item=None):
        self._stop_event.set()
        is_svc_installed, is_svc_running = self.is_windows_service_active()
        if not is_svc_running:
            self.stop_local_process()
        self.kill_stray_agent_processes()

        if self.icon:
            self.icon.stop()

    def check_updates(self, icon=None, item=None):
        if self.icon:
            self.icon.notify("Verificando se ha atualizacoes do Voron - Agente Local...", "Voron Updater")

        def run_check():
            try:
                base_url = self.backend_url.replace("/agent-tunnel", "").replace("ws://", "http://").replace("wss://", "https://")
                url = f"{base_url}/api/agent/update/version?current=1.0.0"
                req = urllib.request.Request(url, headers={"User-Agent": "VoronTray/1.0.0"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode('utf-8'))
                        if data.get("hasUpdate"):
                            ver = data.get("latest", "nova")
                            if self.icon:
                                self.icon.notify(f"Nova versao v{ver} disponivel! O Voron - Agente Local iniciara a atualizacao.", "Voron")
                        else:
                            if self.icon:
                                self.icon.notify("O Voron - Agente Local ja esta executando na versao mais recente.", "Voron Atualizado")
            except Exception as e:
                if self.icon:
                    self.icon.notify(f"Nao foi possivel verificar atualizacoes: {e}", "Voron Updater")

        threading.Thread(target=run_check, daemon=True).start()

    def build_menu(self):
        menu_items = [
            item(lambda text: f"Status: {self.status}", lambda: None, enabled=False),
            item(lambda text: f"Gateway: {self.backend_url}", lambda: None, enabled=False),
            Menu.SEPARATOR,
            item("Testar Conexao Backend", self.test_backend),
            item("Testar Conexao Firebird", self.test_database),
            item("Verificar Atualizacoes...", self.check_updates),
            item("Configuracoes...", self.open_config, default=True),
            item("Ver Logs do Agente...", self.open_logs),
            Menu.SEPARATOR,
        ]

        if self.has_local_backend:
            menu_items.append(item("Iniciar Servidor Backend (Dev)", self.start_backend_dev, visible=lambda item: not self.is_backend_reachable))

        menu_items.extend([
            item("Reiniciar Agente", self.restart_agent),
            item("Iniciar Agente", self.start_agent, visible=lambda item: not self.is_process_running),
            item("Parar Agente", self.stop_agent, visible=lambda item: self.is_process_running),
            Menu.SEPARATOR,
            item("Instalar como Servico Windows (Admin)", self.install_windows_service, visible=lambda item: not self.is_service_installed),
            Menu.SEPARATOR,
            item("Sair da Bandeja", self.quit_app)
        ])

        return Menu(*menu_items)

    def start(self):
        log_tray("Iniciando VoronTrayApp...")
        self.kill_stray_agent_processes()
        self.refresh_status()

        poll_thread = threading.Thread(target=self.status_poll_loop, daemon=True)
        poll_thread.start()

        self.icon = pystray.Icon(
            "voron_agent",
            get_tray_icon("green" if self.is_connected else "yellow" if self.is_process_running else "red"),
            title=f"Voron: {self.status}",
            menu=self.build_menu()
        )
        log_tray("Executando self.icon.run()...")
        try:
            self.icon.run()
        except Exception as e:
            log_tray(f"Erro em self.icon.run(): {e}\n{traceback.format_exc()}")
        finally:
            log_tray("self.icon.run() finalizou.")

if __name__ == "__main__":
    try:
        app = AgentTrayApp()
        app.start()
    except Exception as e:
        log_tray(f"Erro crítico no loop principal: {e}\n{traceback.format_exc()}")

import os
import sys
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from PIL import Image

def generate_icons():
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'agent', 'assets'))
    os.makedirs(output_dir, exist_ok=True)
    print(f"Salvando icones em: {output_dir}")

    options = Options()
    options.add_argument('--headless')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1200,1200')
    driver = webdriver.Chrome(options=options)

    # Cores Oficiais Voron
    CROW_COLOR = "#06261c"
    SQUIRCLE_BG = "#ffffff"
    SQUIRCLE_BORDER = "#cbd5e1"

    # SVG da silhueta oficial do Corvo Voron
    CROW_SVG = f"""<svg class='crow' viewBox='0 0 100 100'>
      <path d='M 50 18 C 62 18, 72 22, 86 32 C 74 36, 66 38, 58 40 C 62 52, 60 68, 52 82 C 48 88, 44 92, 42 94 C 40 90, 38 84, 36 76 C 26 66, 22 52, 24 38 C 26 26, 36 18, 50 18 Z' fill='{CROW_COLOR}' />
      <circle cx='50' cy='28' r='3.2' fill='#ffffff' />
    </svg>"""

    # SVG da Engrenagem (Settings / Configuração)
    GEAR_SVG = """<svg class='gear' viewBox='0 0 24 24' fill='none' stroke='#ffffff' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'>
      <path d='M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'></path>
      <circle cx='12' cy='12' r='3'></circle>
    </svg>"""

    def render_icon_element(badge_type, badge_color=None):
        badge_html = ""
        if badge_type == "dot":
            badge_html = f"""<div class='status-dot' style='background: {badge_color};'></div>"""
        elif badge_type == "gear":
            badge_html = f"""<div class='gear-badge'>
              {GEAR_SVG}
            </div>"""

        html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset='utf-8'>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    width: 1024px;
    height: 1024px;
    background: transparent;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }}
  #icon-card {{
    position: relative;
    width: 900px;
    height: 900px;
    background: transparent;
  }}
  .squircle {{
    width: 900px;
    height: 900px;
    background: {SQUIRCLE_BG};
    border-radius: 216px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 18px solid {SQUIRCLE_BORDER};
    overflow: hidden;
  }}
  .crow {{
    width: 680px;
    height: 680px;
  }}
  .status-dot {{
    position: absolute;
    bottom: -8px;
    right: -8px;
    width: 290px;
    height: 290px;
    border-radius: 50%;
    border: 28px solid #ffffff;
    box-shadow: 0 12px 30px rgba(0,0,0,0.25);
  }}
  .gear-badge {{
    position: absolute;
    bottom: -8px;
    right: -8px;
    width: 350px;
    height: 350px;
    border-radius: 50%;
    background: {CROW_COLOR};
    border: 28px solid #ffffff;
    box-shadow: 0 16px 36px rgba(0,0,0,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
  }}
  .gear {{
    width: 190px;
    height: 190px;
  }}
</style>
</head>
<body>
  <div id='icon-card'>
    <div class='squircle'>
      {CROW_SVG}
    </div>
    {badge_html}
  </div>
</body>
</html>"""

        temp_html = os.path.abspath('temp_render.html')
        with open(temp_html, 'w', encoding='utf-8') as f:
            f.write(html)

        driver.get('file:///' + temp_html.replace(os.sep, '/'))
        element = driver.find_element(By.ID, 'icon-card')
        temp_png = os.path.abspath('temp_screenshot.png')
        element.screenshot(temp_png)

        if os.path.exists(temp_html):
            os.remove(temp_html)

        img = Image.open(temp_png).convert('RGBA')
        img_1024 = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
        # Centralizar 900x900 em 1024x1024
        img_1024.paste(img, (62, 62), img)

        if os.path.exists(temp_png):
            os.remove(temp_png)

        return img_1024

    targets = [
        # (tipo, cor_badge, nome_base, gera_ico)
        ("none", None, "voron_tray", True),
        ("dot", "#16a34a", "voron_tray_online", True),
        ("dot", "#f59e0b", "voron_tray_warning", False),
        ("dot", "#dc2626", "voron_tray_offline", False),
        ("gear", None, "config_voron", True),
    ]

    for b_type, b_color, base_name, gen_ico in targets:
        print(f"Renderizando {base_name} ({b_type})...")
        master = render_icon_element(b_type, b_color)

        # Salva PNG de alta resolucao (512x512)
        png_512 = master.resize((512, 512), Image.Resampling.LANCZOS)
        png_path = os.path.join(output_dir, f"{base_name}.png")
        png_512.save(png_path, "PNG", optimize=True)
        print(f"  -> Salvo: {png_path}")

        # Se for para tray, salvar tambem versoes compactas 64px e 32px para leitura direta veloz
        png_64 = master.resize((64, 64), Image.Resampling.LANCZOS)
        png_64.save(os.path.join(output_dir, f"{base_name}_64.png"), "PNG", optimize=True)

        png_32 = master.resize((32, 32), Image.Resampling.LANCZOS)
        png_32.save(os.path.join(output_dir, f"{base_name}_32.png"), "PNG", optimize=True)

        if gen_ico:
            ico_path = os.path.join(output_dir, f"{base_name}.ico")
            # Preparar camadas multi-resolucao para suporte completo ao Windows
            ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
            master.save(
                ico_path,
                format="ICO",
                sizes=ico_sizes
            )
            print(f"  -> ICO Multi-resolucao salvo: {ico_path}")

    driver.quit()
    print("Todos os icones foram gerados com exito!")

if __name__ == '__main__':
    generate_icons()

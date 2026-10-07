import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from PIL import Image

def generate_app_icons(theme='white'):
    # theme: 'white' (Fundo branco, corvo #06261c, olho branco)
    # ou 'dark' (Fundo #06261c, corvo branco, olho #06261c)
    
    bg_color = '#ffffff' if theme == 'white' else '#06261c'
    crow_color = '#06261c' if theme == 'white' else '#ffffff'
    eye_color = '#ffffff' if theme == 'white' else '#06261c'

    options = Options()
    options.add_argument('--headless')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1024,1024')
    
    driver = webdriver.Chrome(options=options)
    output_dir = os.path.join('mobile', 'public')
    os.makedirs(output_dir, exist_ok=True)

    def render_canvas(size, symbol_scale, output_name):
        # symbol_scale: percentual da viewport ocupado pelo corvo
        # Corvo tem base viewBox 0 0 100 100 centrado em 50, 56
        svg_size = int(size * symbol_scale)
        html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ 
    width: {size}px; 
    height: {size}px; 
    background-color: {bg_color}; 
    overflow: hidden; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
  }}
  .icon-wrapper {{
    width: {svg_size}px;
    height: {svg_size}px;
    display: flex;
    align-items: center;
    justify-content: center;
  }}
  svg {{
    width: 100%;
    height: 100%;
  }}
</style>
</head>
<body>
  <div class="icon-wrapper">
    <svg viewBox="0 0 100 100" fill="{crow_color}" xmlns="http://www.w3.org/2000/svg">
      <path d="M 50 18 C 62 18, 72 22, 86 32 C 74 36, 66 38, 58 40 C 62 52, 60 68, 52 82 C 48 88, 44 92, 42 94 C 40 90, 38 84, 36 76 C 26 66, 22 52, 24 38 C 26 26, 36 18, 50 18 Z" />
      <circle cx="50" cy="28" r="3" fill="{eye_color}" />
    </svg>
  </div>
</body>
</html>"""

        temp_html = os.path.abspath(f'temp_render_{size}.html')
        with open(temp_html, 'w', encoding='utf-8') as f:
            f.write(html_content)

        driver.get(f'file:///{temp_html.replace(os.sep, "/")}')
        temp_png = os.path.abspath(f'temp_raw_{size}.png')
        driver.save_screenshot(temp_png)
        
        if os.path.exists(temp_html):
            os.remove(temp_html)
            
        img = Image.open(temp_png).convert('RGB')
        # Redimensiona para o tamanho exato se o screenshot tiver diferença de densidade de tela
        if img.size != (size, size):
            img = img.resize((size, size), Image.Resampling.LANCZOS)
        img.save(os.path.join(output_dir, output_name), 'PNG', optimize=True)
        
        if os.path.exists(temp_png):
            os.remove(temp_png)

    print(f"Gerando ícones PWA do corvo oficial do Voron (tema: {theme})...")
    # 1. icon-512.png (escala 0.70)
    render_canvas(512, 0.72, 'icon-512.png')

    # 2. icon-192.png
    render_canvas(192, 0.72, 'icon-192.png')

    # 3. Maskable Icons (Android launcher safe zone - escala 0.54)
    render_canvas(512, 0.54, 'icon-maskable-512.png')
    render_canvas(192, 0.54, 'icon-maskable-192.png')

    # 4. Apple Touch Icon (180x180 px Apple HIG)
    render_canvas(180, 0.72, 'apple-touch-icon.png')

    # 5. Favicons
    render_canvas(32, 0.78, 'favicon-32x32.png')
    render_canvas(16, 0.82, 'favicon-16x16.png')

    # Multi-size ICO
    fav16 = Image.open(os.path.join(output_dir, 'favicon-16x16.png'))
    fav32 = Image.open(os.path.join(output_dir, 'favicon-32x32.png'))
    fav48 = Image.open(os.path.join(output_dir, 'favicon-32x32.png')).resize((48, 48), Image.Resampling.LANCZOS)
    fav48.save(
        os.path.join(output_dir, 'favicon.ico'),
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48)]
    )

    driver.quit()
    print("Ícones oficiais do corvo Voron gerados com sucesso!")

if __name__ == '__main__':
    generate_app_icons(theme='white')

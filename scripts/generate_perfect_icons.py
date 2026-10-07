import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from PIL import Image

def generate_perfect_icons(theme='white'):
    bg_color = '#ffffff' if theme == 'white' else '#06261c'
    crow_color = '#06261c' if theme == 'white' else '#ffffff'
    eye_color = '#ffffff' if theme == 'white' else '#06261c'

    options = Options()
    options.add_argument('--headless')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1200,1200')
    
    driver = webdriver.Chrome(options=options)
    output_dir = os.path.join('mobile', 'public')

    def render_master(svg_pixel_size, output_filename):
        html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ 
    width: 1024px; 
    height: 1024px; 
    background-color: {bg_color}; 
    overflow: hidden; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
  }}
  #icon-container {{
    width: 1024px;
    height: 1024px;
    background-color: {bg_color};
    display: flex;
    align-items: center;
    justify-content: center;
  }}
  .icon-wrapper {{
    width: {svg_pixel_size}px;
    height: {svg_pixel_size}px;
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
  <div id="icon-container">
    <div class="icon-wrapper">
      <svg viewBox="0 0 100 100" fill="{crow_color}" xmlns="http://www.w3.org/2000/svg">
        <path d="M 50 18 C 62 18, 72 22, 86 32 C 74 36, 66 38, 58 40 C 62 52, 60 68, 52 82 C 48 88, 44 92, 42 94 C 40 90, 38 84, 36 76 C 26 66, 22 52, 24 38 C 26 26, 36 18, 50 18 Z" />
        <circle cx="50" cy="28" r="3" fill="{eye_color}" />
      </svg>
    </div>
  </div>
</body>
</html>"""

        temp_html = os.path.abspath('temp_master.html')
        with open(temp_html, 'w', encoding='utf-8') as f:
            f.write(html_content)

        driver.get(f'file:///{temp_html.replace(os.sep, "/")}')
        element = driver.find_element(By.ID, 'icon-container')
        temp_png = os.path.abspath('temp_master_out.png')
        element.screenshot(temp_png)
        
        if os.path.exists(temp_html):
            os.remove(temp_html)
            
        im = Image.open(temp_png).convert('RGB')
        im = im.resize((1024, 1024), Image.Resampling.LANCZOS)
        im.save(output_filename, 'PNG', optimize=True)
        if os.path.exists(temp_png):
            os.remove(temp_png)
        return im

    print("Renderizando Master Standard (1024x1024)...")
    # svg de 720px dentro de 1024px dá ~70% de ocupação (ideal para Apple HIG e Standard Icon)
    master_std = render_master(720, 'master_std.png')

    print("Renderizando Master Maskable (1024x1024)...")
    # svg de 540px dentro de 1024px dá ~53% de ocupação (respeitando a safe-zone de 80% do Android)
    master_maskable = render_master(540, 'master_maskable.png')

    driver.quit()

    # Redimensionamentos com anti-aliasing Lanczos
    print("Gerando arquivos finais...")
    master_std.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(output_dir, 'icon-512.png'), 'PNG', optimize=True)
    master_std.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(output_dir, 'icon-192.png'), 'PNG', optimize=True)
    master_std.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(output_dir, 'apple-touch-icon.png'), 'PNG', optimize=True)

    master_maskable.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(output_dir, 'icon-maskable-512.png'), 'PNG', optimize=True)
    master_maskable.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(output_dir, 'icon-maskable-192.png'), 'PNG', optimize=True)

    fav32 = master_std.resize((32, 32), Image.Resampling.LANCZOS)
    fav32.save(os.path.join(output_dir, 'favicon-32x32.png'), 'PNG', optimize=True)

    fav16 = master_std.resize((16, 16), Image.Resampling.LANCZOS)
    fav16.save(os.path.join(output_dir, 'favicon-16x16.png'), 'PNG', optimize=True)

    fav48 = master_std.resize((48, 48), Image.Resampling.LANCZOS)
    fav48.save(
        os.path.join(output_dir, 'favicon.ico'),
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48)]
    )

    if os.path.exists('master_std.png'):
        os.remove('master_std.png')
    if os.path.exists('master_maskable.png'):
        os.remove('master_maskable.png')

    print("Sucesso total! Todos os ícones foram gerados com a geometria oficial do app.")

if __name__ == '__main__':
    generate_perfect_icons(theme='white')

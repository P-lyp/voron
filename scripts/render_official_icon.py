import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from PIL import Image

def render_official_icon():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1024,1024')
    
    driver = webdriver.Chrome(options=options)
    
    # Renderizamos a silhueta exata do corvo utilizada em VoronLogo.tsx e favicon.svg
    html_content = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { 
    width: 1024px; 
    height: 1024px; 
    background: transparent; 
    overflow: hidden; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
  }
  svg { width: 1024px; height: 1024px; }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="24" fill="#ffffff" />
  <path d="M 50 18 C 62 18, 72 22, 86 32 C 74 36, 66 38, 58 40 C 62 52, 60 68, 52 82 C 48 88, 44 92, 42 94 C 40 90, 38 84, 36 76 C 26 66, 22 52, 24 38 C 26 26, 36 18, 50 18 Z" fill="#06261c" />
  <circle cx="50" cy="28" r="3" fill="#ffffff" />
</svg>
</body>
</html>"""

    temp_html = os.path.abspath('temp_icon_test.html')
    with open(temp_html, 'w', encoding='utf-8') as f:
        f.write(html_content)

    driver.get(f'file:///{temp_html.replace(os.sep, "/")}')
    driver.save_screenshot('temp_icon_test.png')
    driver.quit()
    
    if os.path.exists(temp_html):
        os.remove(temp_html)
        
    print("Renderizado com sucesso em temp_icon_test.png!")

if __name__ == '__main__':
    render_official_icon()

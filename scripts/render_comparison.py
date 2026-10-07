import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

def render_comparison():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1024,512')
    
    driver = webdriver.Chrome(options=options)
    
    html_content = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { 
    width: 1024px; 
    height: 512px; 
    background: #e2e8f0; 
    display: flex; 
    align-items: center; 
    justify-content: space-around; 
    padding: 24px;
    font-family: sans-serif;
  }
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .icon-box-white {
    width: 320px;
    height: 320px;
    background: #ffffff;
    border-radius: 72px;
    padding: 40px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .icon-box-dark {
    width: 320px;
    height: 320px;
    background: #06261c;
    border-radius: 72px;
    padding: 40px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  svg {
    width: 100%;
    height: 100%;
  }
  h2 {
    font-size: 18px;
    color: #1e293b;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="icon-box-white">
      <svg viewBox="0 0 100 100" fill="#06261c" xmlns="http://www.w3.org/2000/svg">
        <path d="M 50 18 C 62 18, 72 22, 86 32 C 74 36, 66 38, 58 40 C 62 52, 60 68, 52 82 C 48 88, 44 92, 42 94 C 40 90, 38 84, 36 76 C 26 66, 22 52, 24 38 C 26 26, 36 18, 50 18 Z" />
        <circle cx="50" cy="28" r="3" fill="#ffffff" />
      </svg>
    </div>
    <h2>Opção A: Box Branco (Padrão VoronLogo)</h2>
  </div>

  <div class="card">
    <div class="icon-box-dark">
      <svg viewBox="0 0 100 100" fill="#ffffff" xmlns="http://www.w3.org/2000/svg">
        <path d="M 50 18 C 62 18, 72 22, 86 32 C 74 36, 66 38, 58 40 C 62 52, 60 68, 52 82 C 48 88, 44 92, 42 94 C 40 90, 38 84, 36 76 C 26 66, 22 52, 24 38 C 26 26, 36 18, 50 18 Z" />
        <circle cx="50" cy="28" r="3" fill="#06261c" />
      </svg>
    </div>
    <h2>Opção B: Box Escuro Esmeralda</h2>
  </div>
</body>
</html>"""

    temp_html = os.path.abspath('temp_comparison.html')
    with open(temp_html, 'w', encoding='utf-8') as f:
        f.write(html_content)

    driver.get(f'file:///{temp_html.replace(os.sep, "/")}')
    driver.save_screenshot('temp_comparison.png')
    driver.quit()
    
    if os.path.exists(temp_html):
        os.remove(temp_html)
        
    print("Comparação salva em temp_comparison.png!")

if __name__ == '__main__':
    render_comparison()

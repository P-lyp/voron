import os
from PIL import Image

def generate_icons():
    source_path = os.path.join('mobile', 'public', 'voron-flat-1.jpg')
    if not os.path.exists(source_path):
        raise FileNotFoundError(f"Arquivo fonte não encontrado: {source_path}")

    src_img = Image.open(source_path).convert('RGB')
    
    # Recorte central seguro apenas do pássaro (sem tocar as bordas cinzas do squircle)
    # Dimensões de corte: 584x544 centrado no símbolo
    crop_box = (220, 240, 804, 784)
    bird_crop = src_img.crop(crop_box)
    
    # Cor canônica de fundo executiva Voron Forest Green
    BG_COLOR = (10, 58, 39) # #0a3a27
    
    output_dir = os.path.join('mobile', 'public')
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Função para criar ícone centralizado com proporção customizada
    def make_icon(size, symbol_scale=0.72):
        canvas = Image.new('RGB', (size, size), BG_COLOR)
        # Calcula dimensões do pássaro mantendo aspect ratio
        bw, bh = bird_crop.size
        ratio = bw / bh
        
        target_h = int(size * symbol_scale)
        target_w = int(target_h * ratio)
        if target_w > int(size * symbol_scale):
            target_w = int(size * symbol_scale)
            target_h = int(target_w / ratio)
            
        scaled_bird = bird_crop.resize((target_w, target_h), Image.Resampling.LANCZOS)
        
        pos_x = (size - target_w) // 2
        pos_y = (size - target_h) // 2
        canvas.paste(scaled_bird, (pos_x, pos_y))
        return canvas

    # --- Gerações ---
    print("Gerando icon-512.png...")
    icon_512 = make_icon(512, symbol_scale=0.70)
    icon_512.save(os.path.join(output_dir, 'icon-512.png'), 'PNG', optimize=True)

    print("Gerando icon-192.png...")
    icon_192 = make_icon(192, symbol_scale=0.70)
    icon_192.save(os.path.join(output_dir, 'icon-192.png'), 'PNG', optimize=True)

    # Versões Maskable (Área segura de 80% máxima do W3C / Android 8+)
    print("Gerando icon-maskable-512.png...")
    maskable_512 = make_icon(512, symbol_scale=0.55)
    maskable_512.save(os.path.join(output_dir, 'icon-maskable-512.png'), 'PNG', optimize=True)

    print("Gerando icon-maskable-192.png...")
    maskable_192 = make_icon(192, symbol_scale=0.55)
    maskable_192.save(os.path.join(output_dir, 'icon-maskable-192.png'), 'PNG', optimize=True)

    # Apple Touch Icon (180x180 px - cantos retos opacos no padrão Apple HIG)
    print("Gerando apple-touch-icon.png...")
    apple_icon = make_icon(180, symbol_scale=0.68)
    apple_icon.save(os.path.join(output_dir, 'apple-touch-icon.png'), 'PNG', optimize=True)

    # Favicons (32x32 e 16x16)
    print("Gerando favicons...")
    fav_32 = make_icon(32, symbol_scale=0.78)
    fav_32.save(os.path.join(output_dir, 'favicon-32x32.png'), 'PNG', optimize=True)

    fav_16 = make_icon(16, symbol_scale=0.82)
    fav_16.save(os.path.join(output_dir, 'favicon-16x16.png'), 'PNG', optimize=True)

    # Multi-size favicon.ico
    fav_48 = make_icon(48, symbol_scale=0.75)
    fav_48.save(
        os.path.join(output_dir, 'favicon.ico'),
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48)]
    )

    print("Todos os ícones PWA e móveis gerados com sucesso!")

if __name__ == '__main__':
    generate_icons()

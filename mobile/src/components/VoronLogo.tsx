import React from 'react';

export interface VoronLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  className?: string;
  variant?: 'emerald' | 'dark' | 'light';
  boxVariant?: 'white' | 'emerald';
  subtitle?: string;
  /** Permite forçar o uso do SVG legado caso queira alternar temporariamente */
  useLegacySvg?: boolean;
}

const SIZE_MAP = {
  xs: { box: 'w-6 h-6 rounded-lg', text: 'text-xs', shadow: 'shadow-xs' },
  sm: { box: 'w-8 h-8 rounded-xl', text: 'text-sm', shadow: 'shadow-xs' },
  md: { box: 'w-12 h-12 rounded-2xl', text: 'text-xl', shadow: 'shadow-sm' },
  lg: { box: 'w-16 h-16 rounded-[20px]', text: 'text-2xl', shadow: 'shadow-md' },
  xl: { box: 'w-24 h-24 rounded-[28px]', text: 'text-3xl', shadow: 'shadow-lg' },
};

export const VoronLogo: React.FC<VoronLogoProps> = ({
  size = 'md',
  showWordmark = false,
  className = '',
  variant = 'dark',
  boxVariant = 'white',
  subtitle = 'Inteligência Executiva',
  useLegacySvg = false,
}) => {
  const s = SIZE_MAP[size];

  const titleColor = variant === 'light' ? 'text-white' : 'text-[#0f291e]';
  const subtitleColor = variant === 'light' ? 'text-emerald-400' : 'text-emerald-700/85';

  const isWhiteBox = boxVariant === 'white';

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Ícone idêntico ao atalho do aplicativo no celular (Apple HIG / PWA Oficial) */}
      <div
        className={`${s.box} overflow-hidden shrink-0 flex items-center justify-center transition-transform active:scale-95 select-none ${
          isWhiteBox
            ? `bg-white ${s.shadow} ring-1 ring-stone-900/10`
            : 'bg-[#06261c] shadow-md ring-1 ring-emerald-500/20'
        }`}
      >
        {useLegacySvg ? (
          /* SVG legado (caso seja solicitado rollback explícito) */
          <div className="w-full h-full p-1.5 flex items-center justify-center">
            <svg
              viewBox="0 0 100 100"
              className={`w-full h-full ${isWhiteBox ? 'text-[#06261c]' : 'text-white'}`}
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M 50 18 C 62 18, 72 22, 86 32 C 74 36, 66 38, 58 40 C 62 52, 60 68, 52 82 C 48 88, 44 92, 42 94 C 40 90, 38 84, 36 76 C 26 66, 22 52, 24 38 C 26 26, 36 18, 50 18 Z" />
              <circle cx="50" cy="28" r="3" fill={isWhiteBox ? '#ffffff' : '#06261c'} />
            </svg>
          </div>
        ) : (
          /* Novo Ícone Oficial: Exatamente a mesma imagem em alta resolução renderizada no PWA móvel */
          <img
            src="/apple-touch-icon.png"
            alt="Voron"
            className={`w-full h-full object-contain pointer-events-none select-none ${
              !isWhiteBox ? 'invert hue-rotate-180 brightness-95' : ''
            }`}
            loading="eager"
            draggable={false}
          />
        )}
      </div>

      {/* Tipografia da Marca Opcional */}
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span className={`font-black tracking-tight ${titleColor} ${s.text}`}>
            VORON
          </span>
          {subtitle && (
            <span className={`text-[10px] font-bold uppercase tracking-wider ${subtitleColor} mt-0.5`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default VoronLogo;

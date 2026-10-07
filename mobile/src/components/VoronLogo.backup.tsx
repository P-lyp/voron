import React from 'react';

export interface VoronLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  className?: string;
  variant?: 'emerald' | 'dark' | 'light';
  boxVariant?: 'white' | 'emerald';
  subtitle?: string;
}

const SIZE_MAP = {
  xs: { box: 'w-6 h-6 rounded-lg p-0.5', text: 'text-xs' },
  sm: { box: 'w-8 h-8 rounded-xl p-1', text: 'text-sm' },
  md: { box: 'w-12 h-12 rounded-2xl p-1.5', text: 'text-xl' },
  lg: { box: 'w-16 h-16 rounded-[20px] p-2', text: 'text-2xl' },
  xl: { box: 'w-24 h-24 rounded-[28px] p-3', text: 'text-3xl' },
};

/**
 * BACKUP DO COMPONENTE ORIGINAL VORONLOGO (VETOR SVG PLANO)
 * Preservado para permitir rollback instantâneo caso desejado.
 */
export const VoronLogoBackup: React.FC<VoronLogoProps> = ({
  size = 'md',
  showWordmark = false,
  className = '',
  variant = 'dark',
  boxVariant = 'white',
  subtitle = 'Inteligência Executiva',
}) => {
  const s = SIZE_MAP[size];

  const titleColor = variant === 'light' ? 'text-white' : 'text-[#0f291e]';
  const subtitleColor = variant === 'light' ? 'text-emerald-400' : 'text-emerald-700/85';

  const isWhiteBox = boxVariant === 'white';
  const boxBg = isWhiteBox
    ? 'bg-white shadow-sm ring-1 ring-stone-900/10'
    : 'bg-[#06261c] shadow-md ring-1 ring-emerald-500/20';

  const iconColor = isWhiteBox ? 'text-[#06261c]' : 'text-white';
  const eyeColor = isWhiteBox ? '#ffffff' : '#06261c';

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Ícone Squircle em Vetor Puro Original */}
      <div
        className={`${s.box} ${boxBg} overflow-hidden shrink-0 flex items-center justify-center transition-transform active:scale-95`}
      >
        <svg
          viewBox="0 0 100 100"
          className={`w-full h-full ${iconColor}`}
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Silhueta da cabeça e bico do corvo em perfil */}
          <path d="M 50 18 C 62 18, 72 22, 86 32 C 74 36, 66 38, 58 40 C 62 52, 60 68, 52 82 C 48 88, 44 92, 42 94 C 40 90, 38 84, 36 76 C 26 66, 22 52, 24 38 C 26 26, 36 18, 50 18 Z" />
          {/* Olho circular do corvo */}
          <circle cx="50" cy="28" r="3" fill={eyeColor} />
        </svg>
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

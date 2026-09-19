import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary';

const BASE = 'rounded-full px-4 py-2 text-sm font-medium transition';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-electric text-white shadow-cta hover:bg-electric-dark hover:shadow-cta-hover disabled:bg-electric/40',
  secondary: 'border border-ink/20 text-ink hover:border-electric',
};

export default function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

const variants = {
  primary: 'bg-ink text-white hover:bg-plum disabled:bg-faint',
  plum: 'bg-plum text-white hover:bg-plum-deep disabled:bg-faint',
  secondary: 'border border-ink text-ink hover:bg-ink hover:text-white disabled:border-line disabled:text-faint disabled:hover:bg-transparent',
  danger: 'border border-alarm text-alarm hover:bg-alarm hover:text-white disabled:border-line disabled:text-faint',
  quiet: 'text-mute underline-offset-4 hover:text-ink hover:underline disabled:text-faint',
};

const sizes = { sm: 'h-8 px-3 text-[13px]', md: 'h-10 px-4 text-sm' };

export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', busy = false, disabled = false, children, ...props }) {
  const sizing = variant === 'quiet' ? 'h-auto px-0 text-sm' : sizes[size];
  return (
    <button type={type} className={`inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap transition-colors duration-150 ${sizing} ${variants[variant]} ${className}`} disabled={busy || disabled} {...props}>
      {busy && <span aria-hidden className="size-3 animate-spin border-2 border-current border-r-transparent" />}
      {children}
    </button>
  );
}

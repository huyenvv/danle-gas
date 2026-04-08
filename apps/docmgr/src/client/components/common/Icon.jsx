export default function Icon({ name, className = '', filled = false, size = 24 }) {
  return (
    <span
      className={`material-symbols-outlined${filled ? ' filled' : ''} ${className}`}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  )
}

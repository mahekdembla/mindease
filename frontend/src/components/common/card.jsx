function Card({ children, className = "" }) {
  return (
    <div
      className={`bg-card border border-border rounded-2xl p-4 ${className}`}
    >
      {children}
    </div>
  );
}

export default Card;
function Button({ children, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`bg-primary text-white px-4 py-2 rounded-xl ${className}`}
    >
      {children}
    </button>
  );
}

export default Button;
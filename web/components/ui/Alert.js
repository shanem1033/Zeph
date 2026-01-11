export default function Alert({ type = 'info', message, onClose }) {
  return (
    <div className={`alert alert-${type}`}>
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="alert-close">&times;</button>
      )}
    </div>
  )
}

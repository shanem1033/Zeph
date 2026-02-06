export default function Input({ label, type = 'text', value, onChange, placeholder, required = false }) {
  return (
    <label className="input-label">
      {label}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="input-field"
      />
    </label>
  )
}

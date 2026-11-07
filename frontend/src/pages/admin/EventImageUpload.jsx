export default function EventImageUpload({
  className,
  file,
  onChange,
  disabled = false,
}) {
  return (
    <label className={className}>
      Event photo
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.files?.[0] || null)}
      />
      {file && <span>{file.name}</span>}
    </label>
  );
}

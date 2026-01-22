export default function UploadButton({
  file,
  onFileSelected,
  hint = "",
  accept = "",
}) {
  return (
    <div className="upload-box">
      <input
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          onFileSelected?.(f);
        }}
      />

      <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
        {file ? (
          <>
            Selected: <b>{file.name}</b> ({Math.round(file.size / 1024)} KB)
          </>
        ) : (
          "No file selected."
        )}
      </div>

      {hint ? (
        <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

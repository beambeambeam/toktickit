interface AttachmentPickerProps {
  disabled?: boolean;
  errors: readonly string[];
  files: readonly File[];
  onChange: (files: File[]) => void;
}

const formatFileSize = (byteSize: number): string => {
  if (byteSize < 1024) {
    return `${byteSize} B`;
  }

  return `${(byteSize / 1024 / 1024).toFixed(2)} MB`;
};

export const AttachmentPicker = ({
  disabled = false,
  errors,
  files,
  onChange,
}: AttachmentPickerProps) => (
  <div className="attachment-picker">
    <label htmlFor="attachments">Attachments (optional)</label>
    <input
      accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
      disabled={disabled}
      id="attachments"
      multiple
      onChange={(event) => {
        onChange([...(event.target.files ?? [])]);
      }}
      type="file"
    />
    <p className="field-help">
      JPG, JPEG, PNG, WEBP, or PDF. Maximum 5 MB per file and 5 active files.
    </p>
    {errors.length > 0 ? (
      <ul className="attachment-errors" role="alert">
        {errors.map((error, index) => (
          <li key={`${error}-${index}`}>{error}</li>
        ))}
      </ul>
    ) : null}
    {files.length > 0 ? (
      <ul className="attachment-file-list" aria-label="Selected attachments">
        {files.map((file) => (
          <li key={`${file.name}-${file.size}-${file.lastModified}`}>
            <span aria-hidden="true">▧</span>
            <span>{file.name}</span>
            <small>{formatFileSize(file.size)}</small>
          </li>
        ))}
      </ul>
    ) : null}
  </div>
);

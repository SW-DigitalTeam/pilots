import React from "react";

/**
 * The persistent privacy indicator. It is always visible while the camera is
 * live and states the guarantee plainly. This is not a dismissible toast — it
 * is a standing promise the teacher and students can see at all times.
 */
export function CameraIndicator({ live }: { live: boolean }): React.JSX.Element | null {
  if (!live) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 16px",
        background: "#000",
        color: "#fff",
        border: "3px solid #fff",
        borderRadius: 999,
        font: "bold 18px system-ui, sans-serif",
        zIndex: 10,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{ width: 14, height: 14, borderRadius: 999, background: "#31d158", display: "inline-block" }}
      />
      Camera on. Nothing is recorded or sent.
    </div>
  );
}

/** Canvas libraries need resolved colours; CSS and charts share the same tokens. */
export function readDesignColors() {
  const probe = document.createElement("span");
  probe.hidden = true;
  document.body.append(probe);
  const read = (token: string) => {
    probe.style.color = `hsl(var(${token}))`;
    return getComputedStyle(probe).color;
  };
  const colors = {
    background: read("--background"),
    panel: read("--card"),
    muted: read("--muted-foreground"),
    border: read("--border"),
    accent: read("--primary"),
  };
  probe.remove();
  return colors;
}

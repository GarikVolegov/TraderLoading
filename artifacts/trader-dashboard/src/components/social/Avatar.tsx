export function Avatar({
  name,
  avatarUrl,
  size = "md",
  ring,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  ring?: string;
}) {
  const s =
    size === "xs"
      ? "w-7 h-7 text-[10px]"
      : size === "sm"
        ? "w-9 h-9 text-xs"
        : size === "lg"
          ? "w-16 h-16 text-xl"
          : "w-10 h-10 text-sm";
  const ringCls = ring ? `ring-2 ${ring}` : "";
  if (avatarUrl)
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${s} ${ringCls} rounded-full object-cover border border-border flex-shrink-0`}
      />
    );
  return (
    <div
      className={`${s} ${ringCls} rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary flex-shrink-0`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

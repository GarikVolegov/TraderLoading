import { useState } from "react";
import { Star } from "lucide-react";

/**
 * Reusable star rating. Read-only by default (display); pass `onChange` to make
 * it an input. `value` may be fractional for display (rounded to whole stars).
 */
export function StarRating({
  value,
  onChange,
  size = 16,
  readOnly = false,
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const interactive = !readOnly && !!onChange;
  const active = hover || value;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = s <= Math.round(active);
        const star = (
          <Star
            style={{ width: size, height: size }}
            className={filled ? "text-amber-400 fill-amber-400" : "text-muted-foreground/40"}
          />
        );
        // Read-only stars render as a plain span, not a disabled button: a
        // display-only star has no interactive semantics, and StarRating
        // readOnly is sometimes placed inside another clickable element
        // (e.g. a community-list row button) — a button nested inside a
        // button is invalid HTML and triggers a hydration warning.
        if (!interactive) {
          return (
            <span key={s} className="cursor-default">
              {star}
            </span>
          );
        }
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange?.(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            className="cursor-pointer"
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}

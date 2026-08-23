import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      },
      [ref],
    );

    // Number inputs change value on wheel while focused. React attaches wheel
    // listeners passively at the root, so block it with a native listener.
    React.useEffect(() => {
      if (type !== "number") return;
      const el = innerRef.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        if (document.activeElement !== el) return;
        e.preventDefault();
        // Keep the page/container scrolling naturally, just not the value.
        let node: HTMLElement | null = el.parentElement;
        while (node) {
          const style = getComputedStyle(node);
          const scrollable = /(auto|scroll|overlay)/.test(style.overflowY);
          if (scrollable && node.scrollHeight > node.clientHeight) {
            node.scrollTop += e.deltaY;
            return;
          }
          node = node.parentElement;
        }
        window.scrollBy(0, e.deltaY);
      };

      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, [type]);

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          type === "number" && "no-spinner",
          className,
        )}
        ref={setRefs}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

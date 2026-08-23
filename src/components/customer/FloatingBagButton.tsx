import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { bagCount } from "@/lib/bag-store";

const FloatingBagButton = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(bagCount());
    update();
    window.addEventListener("roop:bag-updated", update);
    return () => window.removeEventListener("roop:bag-updated", update);
  }, []);

  const label = `Your bag, ${count} item${count === 1 ? "" : "s"}`;

  return (
    <Link
      to="/bag"
      aria-label={label}
      className="fixed z-50 bottom-20 md:bottom-6 right-6 w-14 h-14 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center hover:-translate-y-1 transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <ShoppingCart className="w-6 h-6" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-semibold flex items-center justify-center">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
};

export default FloatingBagButton;

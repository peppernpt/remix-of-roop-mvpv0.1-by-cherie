type Role = "customer" | "vendor";

interface RoleToggleProps {
  role: Role;
  onRoleChange: (role: Role) => void;
}

const RoleToggle = ({ role, onRoleChange }: RoleToggleProps) => {
  return (
    <div className="flex items-center rounded-lg bg-muted p-1 gap-1">
      {(["customer", "vendor"] as Role[]).map((r) => {
        const isActive = role === r;
        return (
          <button
            key={r}
            onClick={() => onRoleChange(r)}
            className={
              "px-5 py-2 text-sm font-medium capitalize rounded-md transition-colors duration-200 " +
              (isActive
                ? "bg-black text-white"
                : "bg-transparent text-black/70 hover:text-black")
            }
          >
            {r === "customer" ? "For Customers" : "For Vendors"}
          </button>
        );
      })}
    </div>
  );
};

export default RoleToggle;

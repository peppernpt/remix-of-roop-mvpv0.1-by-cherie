import { formatDisplayDate } from "@/lib/date-utils";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { emitBookingsChanged } from "@/lib/sync";
import { nextSerial } from "@/lib/sku";
import { formatBookingReference } from "@/lib/booking-reference";

interface UnitBooking {
  id: string;
  status: string;
  rental_start: string;
  rental_end: string;
}

interface UnitRow {
  id: string;
  serial_id: string;
  status: string;
  is_active: boolean;
  condition?: string;
  notes?: string;
  booking?: UnitBooking | null;
  /** True when this unit appears in any booking (past or present). */
  hasBookingHistory?: boolean;
}

interface Props {
  productId: string | null;
  productName: string;
  sku: string;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
  /** Opens the unit/order detail popup for this unit. */
  onViewOrder?: (unitId: string) => void;
}

// A unit in any of these statuses is physically committed to a rental.
const ARCHIVE_BLOCKING_UNIT_STATUSES = new Set([
  "reserved",
  "to_deliver",
  "on_delivery",
  "on_rent",
  "on_return",
  "for_review",
]);

// A unit linked to a booking in any of these statuses is still in play.
const ARCHIVE_BLOCKING_BOOKING_STATUSES = new Set([
  "pending_vendor_review",
  "approved_waiting_payment",
  "payment_submitted",
  "paid",
  "to_deliver",
  "on_delivery",
  "on_rent",
  "on_return",
  "for_review",
]);

const REVIEW_UNIT_STATUSES = new Set(["on_return", "for_review"]);

const statusTone: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-700",
  reserved: "bg-amber-100 text-amber-700",
  to_deliver: "bg-blue-100 text-blue-700",
  on_delivery: "bg-blue-100 text-blue-700",
  on_rent: "bg-violet-100 text-violet-700",
  on_return: "bg-orange-100 text-orange-700",
  for_review: "bg-rose-100 text-rose-700",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  reserved: "Reserved",
  to_deliver: "To Deliver",
  on_delivery: "On Delivery",
  on_rent: "On Rent",
  on_return: "On Return",
  for_review: "For Review",
};

const fmtDate = (d?: string) =>
  d
    ? formatDisplayDate(d)
    : "—";

const ProductUnitsDialog = ({
  productId,
  productName,
  sku,
  open,
  onClose,
  onChanged,
  onViewOrder,
}: Props) => {
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Highest serial suffix ever used (incl. archived) so new serials never collide.
  const newSerial = nextSerial(sku || "ITEM", units.map((u) => u.serial_id ?? ""));

  const addUnit = async (condition: string, notes: string) => {
    if (!productId) return false;
    const { error } = await supabase.from("product_units").insert({
      product_id: productId,
      serial_id: newSerial,
      status: "available",
      condition,
      notes: notes || null,
      is_active: true,
    });
    if (error) {
      toast({ title: "Could not add unit", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Unit added" });
    emitBookingsChanged();
    await load();
    onChanged?.();
    return true;
  };



  const load = async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const { data: us, error } = await supabase
        .from("product_units")
        .select("id, serial_id, status, condition, notes, current_booking_id, is_active")
        .eq("product_id", productId)
        .order("serial_id", { ascending: true });
      if (error) throw error;

      const unitIds = (us ?? []).map((u) => u.id);
      const activeBooking: Record<string, UnitBooking> = {};
      const everBooked = new Set<string>();
      if (unitIds.length) {
        const { data: items } = await supabase
          .from("booking_items")
          .select("product_unit_id, booking_id, bookings:booking_id ( id, status, rental_start, rental_end )")
          .in("product_unit_id", unitIds);
        (items ?? []).forEach((i: any) => {
          everBooked.add(i.product_unit_id);
          const b = i.bookings;
          if (!b || !ARCHIVE_BLOCKING_BOOKING_STATUSES.has(b.status)) return;
          const existing = activeBooking[i.product_unit_id];
          // Keep the earliest still-in-play booking for this unit.
          if (!existing || b.rental_start < existing.rental_start) {
            activeBooking[i.product_unit_id] = {
              id: b.id,
              status: b.status,
              rental_start: b.rental_start,
              rental_end: b.rental_end,
            };
          }
        });
      }

      setUnits(
        (us ?? []).map((u: any) => ({
          id: u.id,
          serial_id: u.serial_id,
          status: u.status,
          is_active: u.is_active !== false,
          condition: u.condition,
          notes: u.notes ?? "",
          booking: activeBooking[u.id] ?? null,
          hasBookingHistory: everBooked.has(u.id),
        })),
      );

    } catch (e: any) {
      toast({ title: "Failed to load units", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && productId) load();
  }, [open, productId]);

  // Persist unit-level meta (condition / notes) to product_units.
  const saveUnitMeta = async (unitId: string, patch: { condition?: string; notes?: string }) => {
    const { error } = await supabase.from("product_units").update(patch).eq("id", unitId);
    if (error) {
      toast({ title: "Could not save unit", description: error.message, variant: "destructive" });
      return false;
    }
    setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, ...patch } : u)));
    emitBookingsChanged();
    onChanged?.();
    return true;
  };




  const canArchive = (u: UnitRow) =>
    u.is_active && !ARCHIVE_BLOCKING_UNIT_STATUSES.has(u.status) && !u.booking;

  const archiveUnit = async (u: UnitRow) => {
    if (!canArchive(u)) return;
    if (
      !confirm(
        "Archive this unit? It will be removed from future customer bookings but kept for records.",
      )
    )
      return;
    // Soft delete only — booking_items keep referencing this row.
    const { error } = await supabase
      .from("product_units")
      .update({ is_active: false, deactivated_at: new Date().toISOString() })
      .eq("id", u.id);
    if (error) {
      toast({ title: "Archive failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Unit archived" });
    emitBookingsChanged();
    await load();
    onChanged?.();
  };

  const restoreUnit = async (u: UnitRow) => {
    const { error } = await supabase
      .from("product_units")
      .update({
        is_active: true,
        deactivated_at: null,
        ...(ARCHIVE_BLOCKING_UNIT_STATUSES.has(u.status) ? {} : { status: "available" }),
      })
      .eq("id", u.id);
    if (error) {
      toast({ title: "Restore failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Unit restored" });
    emitBookingsChanged();
    await load();
    onChanged?.();
  };

  // Permanent delete is only offered for units that were never booked.
  const canDelete = (u: UnitRow) =>
    !u.hasBookingHistory && !u.booking && !ARCHIVE_BLOCKING_UNIT_STATUSES.has(u.status);

  const deleteUnit = async (u: UnitRow) => {
    // Backend re-checks booking history inside the security-definer function.
    const { error } = await supabase.rpc("delete_product_unit_safe", { _unit_id: u.id });
    if (error) {
      toast({
        title: "Could not delete unit",
        description: /booking history/i.test(error.message)
          ? "This unit cannot be deleted because it has booking history. Please archive it instead."
          : error.message,
        variant: "destructive",
      });
      return false;
    }
    toast({ title: "Unit deleted" });
    emitBookingsChanged();
    await load();
    onChanged?.();
    return true;
  };

  const activeUnits = units.filter((u) => u.is_active);
  const archivedCount = units.length - activeUnits.length;
  const visibleUnits = showArchived ? units : activeUnits;

  const total = activeUnits.length;
  const available = activeUnits.filter((u) => u.status === "available").length;
  const onRent = activeUnits.filter((u) =>
    ["on_rent", "to_deliver", "on_delivery", "reserved", "on_return"].includes(u.status),
  ).length;

  const renderBookingCell = (u: UnitRow) => {
    if (!u.is_active) return <span className="text-muted-foreground">Archived</span>;
    if (!u.booking) return <span className="text-muted-foreground">No active booking</span>;
    const ref = formatBookingReference(u.booking.id);
    const dates = (
      <div className="text-[11px] text-muted-foreground">
        {fmtDate(u.booking.rental_start)} → {fmtDate(u.booking.rental_end)}
      </div>
    );
    if (u.booking.status === "pending_vendor_review") {
      return <div className="text-amber-700">Pending request {ref}</div>;
    }
    if (u.booking.status === "on_rent") {
      return (
        <div>
          <div className="text-violet-700">On rent {ref}</div>
          {dates}
        </div>
      );
    }
    return (
      <div>
        <div className="text-foreground">Upcoming {ref}</div>
        {dates}
      </div>
    );
  };

  const renderStatusBadge = (u: UnitRow) =>
    u.is_active ? (
      <Badge variant="secondary" className={`${statusTone[u.status] ?? ""} font-normal`}>
        {STATUS_LABELS[u.status] ?? u.status.replace(/_/g, " ")}
      </Badge>
    ) : (
      <Badge variant="secondary" className="font-normal bg-muted text-muted-foreground">
        Archived
      </Badge>
    );

  const deleteButton = (u: UnitRow) =>
    canDelete(u) ? (
      <Button
        size="sm"
        variant="outline"
        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setDeletingId(u.id)}
      >
        Delete unit
      </Button>
    ) : (
      <span className="text-[11px] text-muted-foreground max-w-[190px] inline-block text-right">
        This unit has booking history and cannot be deleted. Archive it instead.
      </span>
    );

  const renderActions = (u: UnitRow) => {
    if (!u.is_active) {
      return (
        <div className="flex justify-end items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => restoreUnit(u)}>
            Restore unit
          </Button>
          {canDelete(u) && deleteButton(u)}
        </div>
      );
    }
    const busy = !!u.booking || ARCHIVE_BLOCKING_UNIT_STATUSES.has(u.status);
    return (
      <div className="flex justify-end items-center gap-2">
        {busy && (
          <Button size="sm" variant="outline" onClick={() => onViewOrder?.(u.id)}>
            {REVIEW_UNIT_STATUSES.has(u.status) ? "Review item" : "View order"}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setEditingId(u.id)}>
          Edit unit
        </Button>
        {!busy && (
          <Button size="sm" variant="outline" onClick={() => archiveUnit(u)}>
            Archive unit
          </Button>
        )}
        {!busy && deleteButton(u)}
      </div>
    );
  };

  const editingUnit = units.find((u) => u.id === editingId) ?? null;
  const deletingUnit = units.find((u) => u.id === deletingId) ?? null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Individual Units — {productName}</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              SKU: {sku} • Total active: {total} • Available: {available} • On rent: {onRent}
              {archivedCount > 0 ? ` • Archived: ${archivedCount}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-between items-center gap-2">
            <Button size="sm" onClick={() => setAdding(true)}>Add unit</Button>
            {archivedCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setShowArchived((s) => !s)}>
                {showArchived ? "Hide archived units" : `Show archived units (${archivedCount})`}
              </Button>
            )}
          </div>


          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading units…</div>
          ) : visibleUnits.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No units yet for this product.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground tracking-wide">
                  <tr className="border-b border-border">
                    <th className="text-left font-medium py-2 px-2">Serial ID</th>
                    <th className="text-left font-medium py-2 px-2">Status</th>
                    <th className="text-right font-medium py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUnits.map((u) => (
                    <tr key={u.id} className={`border-b border-border/60 ${u.is_active ? "" : "opacity-60"}`}>
                      <td className="py-2 px-2 font-mono text-xs">{u.serial_id}</td>
                      <td className="py-2 px-2">{renderStatusBadge(u)}</td>
                      <td className="py-2 px-2 text-right">{renderActions(u)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3 pt-2">
            <Stat label="Total active" value={total} tone="text-foreground" />
            <Stat label="Available" value={available} tone="text-emerald-600" />
            <Stat label="On rent" value={onRent} tone="text-violet-600" />
            <Stat label="Archived" value={archivedCount} tone="text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>

      <EditUnitDialog
        unit={editingUnit}
        onClose={() => setEditingId(null)}
        onSave={saveUnitMeta}
        statusBadge={editingUnit ? renderStatusBadge(editingUnit) : null}
        bookingInfo={editingUnit ? renderBookingCell(editingUnit) : null}
      />

      <AddUnitDialog
        open={adding}
        serial={newSerial}
        onClose={() => setAdding(false)}
        onSave={addUnit}
      />

      <Dialog open={!!deletingUnit} onOpenChange={(o) => !o && setDeletingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this unit?</DialogTitle>
            <DialogDescription>
              This will permanently remove this unit from your inventory. This action is only
              allowed for units with no booking history.
            </DialogDescription>
          </DialogHeader>
          {deletingUnit && (
            <div className="font-mono text-xs">{deletingUnit.serial_id}</div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeletingId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!deletingUnit) return;
                setDeleting(true);
                const ok = await deleteUnit(deletingUnit);
                setDeleting(false);
                if (ok) setDeletingId(null);
              }}
            >
              {deleting ? "Deleting…" : "Delete unit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>


    </>
  );
};

const AddUnitDialog = ({
  open,
  serial,
  onClose,
  onSave,
}: {
  open: boolean;
  serial: string;
  onClose: () => void;
  onSave: (condition: string, notes: string) => Promise<boolean>;
}) => {
  const [condition, setCondition] = useState("excellent");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCondition("excellent");
      setNotes("");
    }
  }, [open]);

  const handleSave = async () => {
    if (!condition) {
      toast({ title: "Condition is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const ok = await onSave(condition, notes.trim());
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Unit</DialogTitle>
          <DialogDescription>Create one new physical unit for this product.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Serial ID</div>
            <Input value={serial} readOnly className="font-mono text-sm bg-muted/50" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Condition *</div>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select condition" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Unit Notes</div>
            <Input placeholder="Optional note…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Adding…" : "Add unit"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


const EditUnitDialog = ({
  unit,
  onClose,
  onSave,
  statusBadge,
  bookingInfo,
}: {
  unit: UnitRow | null;
  onClose: () => void;
  onSave: (id: string, patch: { condition?: string; notes?: string }) => Promise<boolean>;
  statusBadge: React.ReactNode;
  bookingInfo: React.ReactNode;
}) => {
  const [condition, setCondition] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCondition((unit?.condition ?? "").toLowerCase());
    setNotes(unit?.notes ?? "");
  }, [unit?.id]);

  const handleSave = async () => {
    if (!unit) return;
    setSaving(true);
    const ok = await onSave(unit.id, { condition, notes });
    setSaving(false);
    if (ok) {
      toast({ title: "Unit updated" });
      onClose();
    }
  };

  return (
    <Dialog open={!!unit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Unit</DialogTitle>
          <DialogDescription>Update the condition and notes for this physical unit.</DialogDescription>
        </DialogHeader>

        {unit && (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Serial ID</div>
              <div className="font-mono text-sm">{unit.serial_id}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Status</div>
              {statusBadge}
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Current / Upcoming Booking</div>
              <div className="text-xs">{bookingInfo}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Condition</div>
              <Select value={condition} onValueChange={setCondition} disabled={!unit.is_active}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select condition" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Unit Notes</div>
              <Input
                placeholder="Add unit note…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!unit.is_active}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !unit.is_active}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Stat = ({ label, value, tone }: { label: string; value: number; tone: string }) => (
  <div className="bg-muted/40 rounded-xl p-4 text-center">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`text-2xl font-semibold mt-1 ${tone}`}>{value}</div>
  </div>
);

export default ProductUnitsDialog;


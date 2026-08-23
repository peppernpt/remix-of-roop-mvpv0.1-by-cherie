import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Upload, FileImage, Loader2, CheckCircle2 } from "lucide-react";
import CustomerLayout from "@/components/customer/CustomerLayout";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/customer/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { signPaymentSlip } from "@/lib/payment-slip";
import { formatBookingReference } from "@/lib/booking-reference";
import { emitBookingsChanged } from "@/lib/sync";

const fmtTHB = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

interface BookingDetail {
  id: string;
  status: string;
  rental_start: string;
  rental_end: string;
  rental_total: number;
  deposit_total: number;
  delivery_fee: number;
  grand_total: number;
  discounted_rental_total: number | null;
  payment_slip_url: string | null;
  payment_submitted_at: string | null;
  vendor: { store_name: string } | null;
  items: { id: string; product_name: string; product_image: string | null; rental_price: number; deposit_amount: number }[];
}

const PaymentSlip = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [slipSignedUrl, setSlipSignedUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const load = async () => {
    if (!id || !user) return;
    setLoading(true);
    const { data: b } = await supabase
      .from("bookings")
      .select("id, status, rental_start, rental_end, rental_total, deposit_total, delivery_fee, grand_total, discounted_rental_total, payment_slip_url, payment_submitted_at, vendor_id")
      .eq("id", id)
      .eq("customer_id", user.id)
      .maybeSingle();
    if (!b) {
      setBooking(null);
      setLoading(false);
      return;
    }
    const [{ data: vendor }, { data: items }] = await Promise.all([
      supabase.from("vendors").select("store_name").eq("id", b.vendor_id).maybeSingle(),
      supabase
        .from("booking_items")
        .select("id, rental_price, deposit_amount, product_id, products:product_id(name, product_images(image_url, display_order))")
        .eq("booking_id", b.id),
    ]);
    setBooking({
      id: b.id,
      status: b.status,
      rental_start: b.rental_start,
      rental_end: b.rental_end,
      rental_total: Number(b.rental_total),
      deposit_total: Number(b.deposit_total),
      delivery_fee: Number(b.delivery_fee),
      grand_total: Number(b.grand_total),
      discounted_rental_total: b.discounted_rental_total == null ? null : Number(b.discounted_rental_total),
      payment_slip_url: b.payment_slip_url,
      payment_submitted_at: b.payment_submitted_at,
      vendor: vendor as any,
      items: (items ?? []).map((it: any) => {
        const imgs = (it.products?.product_images ?? [])
          .slice()
          .sort((x: any, y: any) => (x.display_order ?? 0) - (y.display_order ?? 0));
        return {
          id: it.id,
          product_name: it.products?.name ?? "Product",
          product_image: imgs[0]?.image_url ?? null,
          rental_price: Number(it.rental_price),
          deposit_amount: Number(it.deposit_amount),
        };
      }),
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const signed = await signPaymentSlip(booking?.payment_slip_url);
      if (alive) setSlipSignedUrl(signed);
    })();
    return () => {
      alive = false;
    };
  }, [booking?.payment_slip_url]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onSubmit = async () => {
    if (!file || !booking || !user || submitting) return;
    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${booking.id}/slip-${Date.now()}.${ext}`;
      const { data: uploadData, error: upErr } = await supabase.storage
        .from("payment-slips")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      if (!uploadData?.path) throw new Error("Payment slip upload did not return a storage path.");
      const submittedAt = new Date().toISOString();
      const { data: updatedBooking, error: updErr } = await supabase
        .from("bookings")
        .update({
          payment_slip_url: uploadData.path,
          payment_submitted_at: submittedAt,
          status: "payment_submitted",
        })
        .eq("id", booking.id)
        .eq("customer_id", user.id)
        .select("payment_slip_url, payment_submitted_at, status")
        .maybeSingle();
      if (updErr) throw updErr;
      if (!updatedBooking?.payment_slip_url || updatedBooking.status !== "payment_submitted") {
        throw new Error("Payment slip was not saved to the booking.");
      }
      setBooking({
        ...booking,
        payment_slip_url: updatedBooking.payment_slip_url,
        payment_submitted_at: updatedBooking.payment_submitted_at,
        status: updatedBooking.status,
      });
      setSlipSignedUrl(await signPaymentSlip(updatedBooking.payment_slip_url));
      setFile(null);
      emitBookingsChanged();
      setShowSuccess(true);
      setRedirecting(true);
      setTimeout(() => navigate("/tracking"), 1800);
    } catch (e: any) {
      toast({
        title: "Could not submit payment slip. Please try again.",
        description: e?.message,
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };


  if (loading) {
    return (
      <CustomerLayout>
        <div className="bg-card border border-border rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      </CustomerLayout>
    );
  }

  if (!booking) {
    return (
      <CustomerLayout>
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <p className="text-sm text-muted-foreground">Booking not found.</p>
          <Button asChild className="mt-4"><Link to="/home">Back home</Link></Button>
        </div>
      </CustomerLayout>
    );
  }

  const canUpload = booking.status === "approved_waiting_payment" || booking.status === "payment_submitted";
  const alreadySubmitted = booking.status === "payment_submitted";

  return (
    <CustomerLayout>
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-medium">Booking Request</h1>
            <StatusBadge status={booking.status} />
          </div>
          <p className="text-xs text-muted-foreground mb-6">
            Reference: <span className="font-mono">{formatBookingReference(booking.id)}</span>
          </p>

          <Section title="Items">
            <div className="space-y-2">
              {booking.items.map((it) => (
                <div key={it.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                  <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0">
                    {it.product_image && (
                      <img src={it.product_image} alt={it.product_name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{it.product_name}</div>
                    <div className="text-xs text-muted-foreground">Deposit {fmtTHB(it.deposit_amount)}</div>
                  </div>
                  <div className="text-sm font-medium">{fmtTHB(it.rental_price)}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Rental Dates">
            <p className="text-sm">
              {fmtDate(booking.rental_start)} → {fmtDate(booking.rental_end)}
            </p>
          </Section>

          <Section title="Payment Summary">
            <div className="space-y-2 text-sm">
              {booking.discounted_rental_total !== null && booking.discounted_rental_total !== undefined ? (
                <>
                  <Row label="Original Rental Subtotal" value={fmtTHB(booking.rental_total)} strike />
                  <Row
                    label="Promo Discount"
                    value={`-${fmtTHB(Math.max(booking.rental_total - booking.discounted_rental_total, 0))}`}
                  />
                  <Row label="Rental Subtotal After Discount" value={fmtTHB(booking.discounted_rental_total)} />
                </>
              ) : (
                <Row label="Rental Subtotal" value={fmtTHB(booking.rental_total)} />
              )}
              <Row label="Delivery Fee" value={fmtTHB(booking.delivery_fee)} />
              <Row label="Refundable Deposit" value={fmtTHB(booking.deposit_total)} />
              <div className="border-t border-border pt-2 mt-2">
                <Row label="Total to Pay" value={fmtTHB(booking.grand_total)} bold />
              </div>
            </div>
          </Section>


          <Section title="Payment Instructions">
            <div className="rounded-xl bg-muted/50 border border-border p-4 text-sm">
              <p className="font-medium">{booking.vendor?.store_name ?? "Vendor"}</p>
              <p className="text-muted-foreground mt-1">
                Vendor will share payment instructions via chat. Transfer the grand total above and upload your slip below.
              </p>
            </div>
          </Section>



          <Section title="Upload Payment Slip">
            {!canUpload ? (
              <p className="text-sm text-muted-foreground">
                You can upload the slip once the vendor has approved your order and set the delivery fee.
              </p>
            ) : (
              <div className="space-y-3">
                {alreadySubmitted && slipSignedUrl && !file && (
                  <div className="rounded-lg border border-border p-3 bg-muted/20">
                    <p className="text-xs text-muted-foreground mb-2">Currently submitted slip:</p>
                    <a href={slipSignedUrl} target="_blank" rel="noreferrer">
                      <img src={slipSignedUrl} alt="Payment slip" className="max-h-48 rounded" />
                    </a>
                  </div>
                )}

                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-foreground transition-colors">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="max-h-48 rounded" />
                  ) : (
                    <>
                      <FileImage className="w-8 h-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Click to choose a slip image</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>

                <Button onClick={onSubmit} disabled={!file || submitting || redirecting} className="w-full h-11">
                  {submitting || redirecting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>

                  ) : (
                    <><Upload className="w-4 h-4" /> {alreadySubmitted ? "Resubmit Payment Slip" : "Submit Payment Slip"}</>
                  )}
                </Button>
              </div>
            )}
          </Section>
        </div>
      </div>

      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold">Payment slip submitted</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Your payment slip has been sent to the store for confirmation.
            </p>
            <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Redirecting you to Tracking…
            </p>
          </div>
        </div>
      )}
    </CustomerLayout>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-6">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</h3>
    {children}
  </div>
);

const Row = ({ label, value, bold, strike }: { label: string; value: string; bold?: boolean; strike?: boolean }) => (
  <div className={`flex items-center justify-between ${bold ? "text-base font-semibold" : ""}`}>
    <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
    <span className={strike ? "line-through text-muted-foreground" : ""}>{value}</span>
  </div>
);

export default PaymentSlip;

import { useEffect, useState } from "react";
import { Mail, Phone, MapPin, Edit2, User as UserIcon, Save, X, MessageCircle, Instagram } from "lucide-react";
import CustomerLayout, { PageHero } from "@/components/customer/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Profile {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  line_id: string | null;
  instagram_username: string | null;
  created_at: string;
}

interface Address {
  id: string;
  label: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
}

const Profile = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingAddr, setEditingAddr] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", line_id: "", instagram_username: "" });
  const [addrForm, setAddrForm] = useState({
    label: "Home",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "TH",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Reset any previous user's data before loading the current one.
    setProfile(null);
    setAddress(null);
    setEditing(false);
    setEditingAddr(false);
    setForm({ full_name: "", phone: "", line_id: "", instagram_username: "" });
    setAddrForm({
      label: "Home",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      postal_code: "",
      country: "TH",
    });
    if (!user) return;
    (async () => {

      let { data: p } = await supabase
        .from("profiles")
        .select("full_name, email, phone, line_id, instagram_username, created_at")
        .eq("id", user.id)
        .maybeSingle();

      // Defensive upsert: create profile row if missing (legacy accounts)
      if (!p) {
        const { data: created } = await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,
              email: user.email ?? null,
              full_name: (user.user_metadata as any)?.full_name ?? null,
              phone: (user.user_metadata as any)?.phone ?? null,
              line_id: (user.user_metadata as any)?.line_id ?? null,
              instagram_username: (user.user_metadata as any)?.instagram_username ?? null,
              role: "customer",
            },
            { onConflict: "id" }
          )
          .select("full_name, email, phone, line_id, instagram_username, created_at")
          .maybeSingle();
        p = created ?? null;
      } else if (!p.email && user.email) {
        // Backfill email from auth if missing
        await supabase.from("profiles").update({ email: user.email }).eq("id", user.id);
        p = { ...p, email: user.email };
      }

      if (p) {
        setProfile({ ...p, email: p.email ?? user.email ?? null });
        setForm({
          full_name: p.full_name ?? "",
          phone: p.phone ?? "",
          line_id: p.line_id ?? "",
          instagram_username: p.instagram_username ?? "",
        });
      }

      const { data: a } = await supabase
        .from("customer_addresses")
        .select("id, label, address_line1, address_line2, city, state, postal_code, country")
        .eq("customer_id", user.id)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (a) {
        setAddress(a);
        setAddrForm({
          label: a.label ?? "Home",
          address_line1: a.address_line1,
          address_line2: a.address_line2 ?? "",
          city: a.city && a.city !== "—" ? a.city : "",
          state: a.state ?? "",
          postal_code: a.postal_code ?? "",
          country: a.country,
        });
      }

    })();
  }, [user?.id]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name,
        phone: form.phone,
        line_id: form.line_id || null,
        instagram_username: form.instagram_username || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message });
      return;
    }
    setProfile((p) => (p ? { ...p, ...form } : p));
    setEditing(false);
    toast({ title: "Profile updated" });
  };

  const saveAddress = async () => {
    if (!user) return;
    if (!addrForm.address_line1.trim()) {
      toast({ title: "Please enter your address." });
      return;
    }
    if (!addrForm.city.trim() || addrForm.city.trim() === "—") {
      toast({ title: "Please enter your city." });
      return;
    }
    if (!addrForm.postal_code.trim()) {
      toast({ title: "Please enter your postcode." });
      return;
    }
    setSaving(true);
    if (address) {
      const { error } = await supabase
        .from("customer_addresses")
        .update({ ...addrForm, city: addrForm.city.trim() })
        .eq("id", address.id);
      if (error) {
        setSaving(false);
        toast({ title: "Couldn't save", description: error.message });
        return;
      }
      setAddress({ ...address, ...addrForm });
    } else {
      const { data, error } = await supabase
        .from("customer_addresses")
        .insert({ ...addrForm, city: addrForm.city.trim(), customer_id: user.id, is_default: true })
        .select()
        .single();
      if (error) {
        setSaving(false);
        toast({ title: "Couldn't save", description: error.message });
        return;
      }
      setAddress(data as Address);
    }
    setSaving(false);
    setEditingAddr(false);
    toast({ title: "Address updated" });
  };




  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <CustomerLayout hero={<PageHero title="Profile" subtitle="Manage your account information" />}>
      <div className="space-y-4 max-w-3xl">
        {/* Overview */}
        <section className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-muted grid place-items-center text-muted-foreground">
            <UserIcon className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-medium truncate">
              {profile?.full_name || "Customer"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {memberSince ? `Customer since ${memberSince}` : ""}
            </p>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </Button>
          )}
        </section>

        {/* Personal info */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-medium mb-4">Personal information</h3>
          {editing ? (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Full name</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">LINE ID</Label>
                <Input
                  placeholder="e.g. roop.user"
                  value={form.line_id}
                  onChange={(e) => setForm({ ...form, line_id: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Instagram</Label>
                <Input
                  placeholder="e.g. @roop.user"
                  value={form.instagram_username}
                  onChange={(e) => setForm({ ...form, instagram_username: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveProfile} disabled={saving}>
                  <Save className="w-3.5 h-3.5" /> Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              <Field icon={<Mail className="w-4 h-4" />} label="Email" value={profile?.email ?? "—"} />
              <Field icon={<Phone className="w-4 h-4" />} label="Phone" value={profile?.phone ?? "—"} />
              <Field
                icon={<MessageCircle className="w-4 h-4" />}
                label="LINE ID"
                value={profile?.line_id || "Not added"}
              />
              <Field
                icon={<Instagram className="w-4 h-4" />}
                label="Instagram"
                value={profile?.instagram_username || "Not added"}
              />
            </div>
          )}
        </section>

        {/* Address */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Delivery address</h3>
            {!editingAddr && (
              <button
                onClick={() => setEditingAddr(true)}
                className="text-sm text-foreground hover:underline"
              >
                {address ? "Edit" : "Add"}
              </button>
            )}
          </div>
          {editingAddr ? (
            <div className="space-y-3">
              <Input
                placeholder="Label (Home, Office…)"
                value={addrForm.label}
                onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}
              />
              <Input
                placeholder="Address line 1"
                value={addrForm.address_line1}
                onChange={(e) => setAddrForm({ ...addrForm, address_line1: e.target.value })}
              />
              <Input
                placeholder="Address line 2 (optional)"
                value={addrForm.address_line2}
                onChange={(e) => setAddrForm({ ...addrForm, address_line2: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="City"
                  value={addrForm.city}
                  onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                />
                <Input
                  placeholder="Postal code"
                  value={addrForm.postal_code}
                  onChange={(e) => setAddrForm({ ...addrForm, postal_code: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveAddress} disabled={saving}>
                  <Save className="w-3.5 h-3.5" /> Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingAddr(false)}>
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
              </div>
            </div>
          ) : address ? (
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted grid place-items-center shrink-0">
                <MapPin className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-sm">
                <p className="font-medium">{address.label || "Address"}</p>
                <p className="text-muted-foreground">{address.address_line1}</p>
                {address.address_line2 && (
                  <p className="text-muted-foreground">{address.address_line2}</p>
                )}
                <p className="text-muted-foreground">
                  {address.city && address.city !== "—" ? address.city : "City not added"}
                  {address.postal_code ? `, ${address.postal_code}` : ""}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No delivery address yet.</p>
          )}
        </section>




        {/* Account */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-medium mb-4">Account</h3>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start h-11" onClick={signOut}>
              Sign out
            </Button>
            <button
              type="button"
              onClick={() =>
                toast({
                  title: "Contact support",
                  description: "Account deletion is handled via ROOP customer service.",
                })
              }
              className="w-full text-left text-sm font-medium text-destructive border border-destructive/30 rounded-lg h-11 px-4 hover:bg-destructive/5 transition-colors"
            >
              Delete account
            </button>
          </div>
        </section>
      </div>
    </CustomerLayout>
  );
};

const Field = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex items-center gap-3 py-3">
    <div className="w-9 h-9 rounded-lg bg-muted grid place-items-center text-muted-foreground shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium truncate">{value}</p>
    </div>
  </div>
);

export default Profile;

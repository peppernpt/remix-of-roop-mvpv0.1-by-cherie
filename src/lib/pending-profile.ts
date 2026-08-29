// ROOP — signup data that must survive the email-confirmation round trip.
//
// When email confirmation is ON, signUp returns no session, so the address /
// contact details typed during signup can't be written yet (RLS requires an
// authenticated session). They are stashed in localStorage keyed by email and
// applied on the first authenticated session for that email.
//
// Keys deliberately live OUTSIDE the user-scoped prefixes (user-scope.ts):
// they exist precisely while no user scope exists yet, and are matched to the
// signing-in user by email before being consumed.

import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const CUSTOMER_KEY_PREFIX = "roop:pending-customer:";
const VENDOR_KEY_PREFIX = "roop:pending-store:";

const keyFor = (prefix: string, email: string) => `${prefix}${email.trim().toLowerCase()}`;

const safeGet = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable — signup still succeeds, data is just not carried over */
  }
};
const safeRemove = (k: string) => {
  try {
    localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
};

// ---------- Customer ----------

export interface PendingCustomerProfile {
  fullName: string;
  phone: string;
  username: string;
  lineId: string | null;
  instagram: string | null;
  address: string;
  city: string;
  postcode: string;
}

export const stashPendingCustomerProfile = (email: string, data: PendingCustomerProfile) =>
  safeSet(keyFor(CUSTOMER_KEY_PREFIX, email), JSON.stringify(data));

/**
 * Apply any stashed signup data for this user's email. Safe to call on every
 * sign-in: it is a no-op when nothing is stashed, and the stash is removed
 * only after the writes succeed.
 */
export const completePendingCustomerProfile = async (user: User): Promise<void> => {
  if (!user.email) return;
  const k = keyFor(CUSTOMER_KEY_PREFIX, user.email);
  const raw = safeGet(k);
  if (!raw) return;
  let data: PendingCustomerProfile;
  try {
    data = JSON.parse(raw) as PendingCustomerProfile;
  } catch {
    safeRemove(k);
    return;
  }
  const { error: pErr } = await supabase
    .from("profiles")
    .update({
      full_name: data.fullName || null,
      phone: data.phone || null,
      username: data.username || null,
      email: user.email,
      line_id: data.lineId,
      instagram_username: data.instagram,
    })
    .eq("id", user.id);
  if (pErr) return; // keep the stash — retried on next sign-in

  if (data.address?.trim()) {
    const { data: existing } = await supabase
      .from("customer_addresses")
      .select("id")
      .eq("customer_id", user.id)
      .limit(1);
    if (!existing?.length) {
      const { error: aErr } = await supabase.from("customer_addresses").insert({
        customer_id: user.id,
        address_line1: data.address,
        city: data.city?.trim() || "",
        postal_code: data.postcode || null,
        country: "TH",
        is_default: true,
      });
      if (aErr) return; // keep the stash for a retry
    }
  }
  safeRemove(k);
};

// ---------- Vendor ----------

export interface PendingStore {
  storeName: string;
  storeCategory: string;
  storeDescription: string;
  storeAddress: string;
  subdistrict: string;
  city: string;
  postalCode: string;
  lineId: string;
  instagram: string;
  rentalPolicy: string;
}

export const stashPendingStore = (email: string, data: PendingStore) =>
  safeSet(keyFor(VENDOR_KEY_PREFIX, email), JSON.stringify(data));

export const readPendingStore = (email: string | null | undefined): PendingStore | null => {
  if (!email) return null;
  const raw = safeGet(keyFor(VENDOR_KEY_PREFIX, email));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingStore;
  } catch {
    return null;
  }
};

export const clearPendingStore = (email: string | null | undefined) => {
  if (email) safeRemove(keyFor(VENDOR_KEY_PREFIX, email));
};

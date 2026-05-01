// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
const supabase = createClient();
type Tab =
  | "dashboard"
  | "rooms"
  | "bookings"
  | "checkouts"
  | "guests"
  | "payments"
  | "invoices"
  | "expenses"
  | "maintenance"
  | "audit_logs"
  | "reports";
type RoomStatus =
  | "Available"
  | "Occupied"
  | "Reserved"
  | "Cleaning"
  | "Maintenance";
type BookingStatus = "Reserved" | "Checked In" | "Checked Out" | "Cancelled";
type BillingType = "Night" | "Month";
type Room = {
  id: number;
  room_number: string;
  room_type: string;
  price: number;
  billing_type: BillingType;
  status: RoomStatus;
  notes: string | null;
  created_at?: string;
};
type Guest = {
  id: number;
  full_name: string;
  phone: string | null;
  email: string | null;
  id_number: string | null;
  address: string | null;
  notes: string | null;
  created_at?: string;
};
type Booking = {
  id: number;
  booking_reference?: string | null;
  guest_name: string;
  phone: string | null;
  room_id: number | null;
  room_number: string | null;
  check_in_date: string;
  check_out_date: string;
  total_amount: number;
  deposit: number;
  balance: number;
  status: BookingStatus;
  created_at?: string;
};
type Payment = {
  id: number;
  booking_id: number;
  amount: number;
  payment_method: string | null;
  payment_date: string | null;
  guest_name?: string | null;
  room_number?: string | null;
  notes?: string | null;
  created_at?: string;
};

type Expense = {
  id: number;
  expense_date: string | null;
  category: string | null;
  description: string | null;
  amount: number;
  payment_method: string | null;
  recorded_by: string | null;
  notes: string | null;
  created_at?: string;
};

type MaintenanceJob = {
  id: number;
  room_id: number | null;
  room_number: string | null;
  issue_title: string | null;
  issue_description: string | null;
  priority: string | null;
  status: string | null;
  reported_date: string | null;
  completed_date: string | null;
  cost: number;
  handled_by: string | null;
  notes: string | null;
  created_at?: string;
};

type AuditLog = {
  id: number;
  action_type: string | null;
  table_name: string | null;
  record_id: string | null;
  description: string | null;
  staff_email: string | null;
  created_at?: string;
};

type StaffRole = "Manager" | "Reception" | "Maintenance" | "No Access";
type StaffProfile = {
  id: number;
  user_id: string | null;
  email: string;
  full_name: string | null;
  role: StaffRole;
  is_active: boolean;
  created_at?: string;
};
const TAB_LABELS: Record<Tab, string> = {
  dashboard: "Dashboard",
  rooms: "Rooms",
  bookings: "Bookings",
  checkouts: "Check-Out",
  guests: "Guests",
  payments: "Payments",
  invoices: "Invoices",
  expenses: "Expenses",
  maintenance: "Maintenance",
  audit_logs: "Audit Logs",
  reports: "Reports",
};
const ROLE_ALLOWED_TABS: Record<StaffRole, Tab[]> = {
  Manager: ["dashboard", "rooms", "bookings", "checkouts", "guests", "payments", "invoices", "expenses", "maintenance", "audit_logs", "reports"],
  Reception: ["dashboard", "rooms", "bookings", "checkouts", "guests", "payments", "invoices"],
  Maintenance: ["dashboard", "maintenance"],
  "No Access": [],
};
function normalizeStaffRole(role: string | null | undefined): StaffRole {
  if (role === "Manager" || role === "Reception" || role === "Maintenance") return role;
  return "No Access";
}
function canAccessTab(role: StaffRole, tab: Tab) {
  return ROLE_ALLOWED_TABS[role]?.includes(tab) || false;
}
function getDefaultTabForRole(role: StaffRole): Tab {
  return ROLE_ALLOWED_TABS[role]?.[0] || "dashboard";
}


type BookingView = Booking & {
  paid: number;
  due: number;
  roomPaid: number;
  keyDepositRequired: number;
  keyDepositPaid: number;
  keyDepositRefunded: number;
  keyDepositOutstanding: number;
  keyDepositStatus: string;
  guestEmail?: string | null;
  room?: Room | undefined;
};
function todayDate() {
  return new Date().toLocaleDateString("en-GB", {
    timeZone: "Pacific/Port_Moresby",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function isoToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Port_Moresby" });
}
function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
}
function formatK(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return `K${amount.toLocaleString()}`;
}
function formatInvoiceNumber(value: number | string | null | undefined) {
  return `INV-${String(value || 0).padStart(6, "0")}`;
}
function formatReceiptNumber(value: number | string | null | undefined) {
  return `RCPT-${String(value || 0).padStart(6, "0")}`;
}
function getInvoiceStatus(booking: any) {
  const due = Number(booking?.due || 0);
  const paid = Number(booking?.roomPaid || 0);
  if (paid <= 0) return "Unpaid";
  if (due > 0) return "Part Paid";
  return "Paid";
}
const KEY_DEPOSIT_RECEIVED_PREFIX = "Key Deposit Received";
const KEY_DEPOSIT_REFUNDED_PREFIX = "Key Deposit Refunded";
function getKeyDepositRequiredByRoomType(roomType: string | null | undefined) {
  const normalized = String(roomType || "").toLowerCase().trim();
  if (normalized.includes("apartment")) return 50;
  if (normalized.includes("single")) return 20;
  if (normalized.includes("deluxe") || normalized.includes("dulaxe")) return 20;
  return 0;
}
function isKeyDepositReceivedPayment(payment: Payment) {
  const label = `${payment.payment_method || ""} ${payment.notes || ""}`;
  return label.includes(KEY_DEPOSIT_RECEIVED_PREFIX);
}
function isKeyDepositRefundPayment(payment: Payment) {
  const label = `${payment.payment_method || ""} ${payment.notes || ""}`;
  return label.includes(KEY_DEPOSIT_REFUNDED_PREFIX);
}
function isRoomRevenuePayment(payment: Payment) {
  return !isKeyDepositReceivedPayment(payment) && !isKeyDepositRefundPayment(payment);
}
function isCheckOutPayment(payment: Payment) {
  const label = `${payment.payment_method || ""} ${payment.notes || ""}`;
  return label.includes("Check-Out Payment");
}
function getKeyDepositMethodLabel(action: "received" | "refunded", method: string) {
  return `${action === "received" ? KEY_DEPOSIT_RECEIVED_PREFIX : KEY_DEPOSIT_REFUNDED_PREFIX} - ${method}`;
}
const RECEIPT_BUSINESS = {
  name: "Boroko Motel & Apartments",
  organization: "The Salvation Army - Papua New Guinea and Solomon Islands Territory",
  address1: "Territorial Headquarters, Angau Drive, Boroko",
  address2: "PO Box 1323, Boroko, NCD, Papua New Guinea",
  phones: "Office: +675 325 5507  |  Mobile: +675 7343 2937 \/ +675 7684 6158",
  website: "https://www.salvationarmy.org.pg",
  logo: "data:image/jpeg;base64,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1wfmNT+NmFR/f+smL/WPBw/h4OC+7/5FH53J8J/26PGfF1pvjmcOOf7Q1WWMf+RZBVyx/YG/an8RyCXVtDtLYt1k1LWo2I+uwua/QbA9KKuPAeXSd61apJ+q/wAv1IfFmNjpTpwj8n/mfEGif8EwPizc4Ov+P9AsweotlmnI/Aog/Wuw0P8A4Ja+HYSreJfi3fXHPzLY6YkP6uz/AMq+r6K7qPBfD1Lek5espfo0jlqcTZzU/wCXlvRL/I8F0D/gnJ+znpO1tTttY1Rh1+16mVB/CJUruPD37KH7Ofhkq2mfCDRnZej3tt9pP5zbq9Cor1qGSZRh/wCHQgn/AIVf79zz6uaZjW+OtJ/NlPSvD2gaFALXRNEtLOIdI7W2WNR+CgVcoor04xjFWSscLbk7sKKKKYgooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA/9k=",
};
function getRoomStatusFromBooking(status: BookingStatus): RoomStatus {
  if (status === "Checked In") return "Occupied";
  if (status === "Reserved") return "Reserved";
  if (status === "Checked Out") return "Cleaning";
  return "Available";
}
function calculateDuration(
  billingType: BillingType | undefined,
  checkInDate: string,
  checkOutDate: string
) {
  if (!billingType || !checkInDate || !checkOutDate) return 0;
  const start = new Date(checkInDate);
  const end = new Date(checkOutDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (billingType === "Month") {
    return Math.max(1, Math.ceil(Math.max(diffDays, 1) / 30));
  }
  return Math.max(1, diffDays);
}
function calculateNights(checkInDate: string, checkOutDate: string) {
  if (!checkInDate || !checkOutDate) return 1;
  const start = new Date(checkInDate);
  const end = new Date(checkOutDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}
function generateBookingReference() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}`.padStart(6, "0");
  const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `BK-${datePart}-${timePart}-${randomPart}`;
}
function dateInRange(dateValue: string | null | undefined, start: string, end: string) {
  if (!dateValue) return false;
  const onlyDate = String(dateValue).slice(0, 10);
  return onlyDate >= start && onlyDate <= end;
}
function normalize(value: any) {
  return String(value || "").toLowerCase().trim();
}
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart < bEnd && bStart < aEnd;
}
const roomStatusStyles: Record<RoomStatus, string> = {
  Available: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Occupied: "bg-rose-100 text-rose-700 border-rose-200",
  Reserved: "bg-amber-100 text-amber-700 border-amber-200",
  Cleaning: "bg-sky-100 text-sky-700 border-sky-200",
  Maintenance: "bg-slate-200 text-slate-700 border-slate-300",
};
const bookingStatusStyles: Record<BookingStatus, string> = {
  Reserved: "bg-amber-100 text-amber-700 border-amber-200",
  "Checked In": "bg-rose-100 text-rose-700 border-rose-200",
  "Checked Out": "bg-emerald-100 text-emerald-700 border-emerald-200",
  Cancelled: "bg-slate-200 text-slate-700 border-slate-300",
};
function AppShell({
  children,
  title,
  subtitle,
  activeTab,
  setActiveTab,
  onSignOut,
  userEmail,
  staffRole = "No Access",
  staffName = "",
}: any) {
  const visibleTabs = ROLE_ALLOWED_TABS[staffRole as StaffRole] || [];
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white lg:block">
          <div className="border-b border-white/10 p-6">
            <div className="rounded-3xl bg-white/5 p-4 shadow-lg ring-1 ring-white/10 backdrop-blur">
              <h1 className="text-3xl font-black tracking-tight">MTECH Stay</h1>
              <p className="mt-1 text-sm text-slate-300">Premium Motel Suite</p>
            </div>
          </div>
          <div className="px-4 py-5">
            <div className="mb-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Signed in</p>
              <p className="mt-2 break-all text-sm font-medium text-slate-100">{userEmail}</p>
              {staffName && <p className="mt-1 text-xs text-slate-400">{staffName}</p>}
              <div className="mt-3 inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-indigo-100">
                {staffRole}
              </div>
            </div>
            <nav className="space-y-2">
              {visibleTabs.map((tab: Tab) => (
                <SidebarButton key={tab} label={TAB_LABELS[tab]} active={activeTab === tab} onClick={() => setActiveTab(tab)} />
              ))}
            </nav>
            <button
              onClick={onSignOut}
              className="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Sign Out
            </button>
          </div>
        </aside>
        <div className="flex-1">
          <header className="border-b border-slate-200 bg-white/90 px-4 py-4 shadow-sm backdrop-blur sm:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600">
                  Live Motel Operations
                </p>
                <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900">{title}</h2>
                <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-2 lg:hidden">
                {visibleTabs.map((tab: Tab) => (
                  <MobileTabButton key={tab} label={tab === "audit_logs" ? "Audit" : TAB_LABELS[tab]} active={activeTab === tab} onClick={() => setActiveTab(tab)} />
                ))}
              </div>
            </div>
          </header>
          <div className="p-4 sm:p-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
export default function MotelSupabasePremiumPage() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [user, setUser] = useState<any>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [staffRole, setStaffRole] = useState<StaffRole>("No Access");
  const [staffLoading, setStaffLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authForm, setAuthForm] = useState({
    full_name: "",
    email: "",
    password: "",
  });
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [maintenanceJobs, setMaintenanceJobs] = useState<MaintenanceJob[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [roomSearch, setRoomSearch] = useState("");
  const [roomStatusFilter, setRoomStatusFilter] = useState("All");
  const [guestSearch, setGuestSearch] = useState("");
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("All");
  const [bookingDateFilter, setBookingDateFilter] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("All");
  const [paymentDateFilter, setPaymentDateFilter] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("All");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("All");
  const [maintenanceSearch, setMaintenanceSearch] = useState("");
  const [maintenanceStatusFilter, setMaintenanceStatusFilter] = useState("All");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("All");
  const [reportStartDate, setReportStartDate] = useState(firstDayOfMonth());
  const [reportEndDate, setReportEndDate] = useState(todayDate());
  const [roomForm, setRoomForm] = useState({
    room_number: "",
    room_type: "Apartment",
    price: 399,
    billing_type: "Night" as BillingType,
    status: "Available" as RoomStatus,
    notes: "",
  });
  const [guestForm, setGuestForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    id_number: "",
    address: "",
    notes: "",
  });
  const [bookingForm, setBookingForm] = useState({
    guest_name: "",
    phone: "",
    room_id: 0,
    check_in_date: "",
    check_out_date: "",
    deposit: 0,
    status: "Reserved" as BookingStatus,
    notes: "",
    deposit_method: "Cash",
    payment_arrangement: "Reserve Only",
    organization_name: "",
    reference_no: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    booking_id: 0,
    amount: 0,
    payment_method: "Cash",
    payment_date: todayDate(),
  });
  const [expenseForm, setExpenseForm] = useState({
    expense_date: isoToday(),
    category: "Maintenance",
    description: "",
    amount: 0,
    payment_method: "Cash",
    recorded_by: "",
    notes: "",
  });
  const [maintenanceForm, setMaintenanceForm] = useState({
    room_id: 0,
    room_number: "",
    issue_title: "",
    issue_description: "",
    priority: "Normal",
    status: "Open",
    reported_date: isoToday(),
    completed_date: "",
    cost: 0,
    handled_by: "",
    notes: "",
  });
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [editingGuestId, setEditingGuestId] = useState<number | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<number | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editingMaintenanceId, setEditingMaintenanceId] = useState<number | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [checkoutBookingId, setCheckoutBookingId] = useState<number | null>(null);
  const [checkoutFinalPayment, setCheckoutFinalPayment] = useState("0");
  const [checkoutAdditionalCharges, setCheckoutAdditionalCharges] = useState("0");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [checkoutRefundKeyDeposit, setCheckoutRefundKeyDeposit] = useState(true);
  const [checkoutRefundMethod, setCheckoutRefundMethod] = useState("Cash");
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState("Cash");
  function openTab(tab: Tab) {
    if (!canAccessTab(staffRole, tab)) {
      showToast("Access denied. Your role (" + staffRole + ") cannot open " + TAB_LABELS[tab] + ".", "error");
      return;
    }
    setActiveTab(tab);
  }
  async function loadStaffProfile(currentUser: any) {
    setStaffLoading(true);
    try {
      const email = String(currentUser?.email || "").trim().toLowerCase();
      if (!email) {
        setStaffProfile(null);
        setStaffRole("No Access");
        return null;
      }
      const { data, error } = await supabase
        .from("motel_staff_profiles")
        .select("*")
        .eq("email", email)
        .maybeSingle();
      if (error) throw error;
      if (!data || data.is_active === false) {
        setStaffProfile(null);
        setStaffRole("No Access");
        return null;
      }
      const role = normalizeStaffRole(data.role);
      const profile = { ...data, role } as StaffProfile;
      setStaffProfile(profile);
      setStaffRole(role);
      if (!canAccessTab(role, activeTab)) setActiveTab(getDefaultTabForRole(role));
      if (!data.user_id && currentUser?.id) {
        await supabase.from("motel_staff_profiles").update({ user_id: currentUser.id }).eq("id", data.id);
      }
      return profile;
    } catch (error: any) {
      setStaffProfile(null);
      setStaffRole("No Access");
      showToast(error.message || "Failed to load staff role.", "error");
      return null;
    } finally {
      setStaffLoading(false);
    }
  }

  function showToast(text: string, type: "success" | "error" | "info" = "info") {
    setMessage(text);
    setMessageType(type);
  }

  async function logAudit(actionType: string, tableName: string, recordId: any, description: string) {
    try {
      await supabase.from("motel_audit_logs").insert({
        action_type: actionType,
        table_name: tableName,
        record_id: recordId === null || recordId === undefined ? null : String(recordId),
        description,
        staff_email: (user?.email || "system") + (staffRole !== "No Access" ? " (" + staffRole + ")" : ""),
      });
    } catch (error) {
      console.warn("Audit log skipped:", error);
    }
  }
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
      setBooting(false);
    };
    run();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (!session?.user) {
        setStaffProfile(null);
        setStaffRole("No Access");
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const run = async () => {
      if (!user) {
        setLoading(false);
        setStaffProfile(null);
        setStaffRole("No Access");
        return;
      }
      setLoading(true);
      const profile = await loadStaffProfile(user);
      if (!profile) {
        setLoading(false);
        return;
      }
      await loadAllData(false);
    };
    run();
  }, [user]);
  useEffect(() => {
    if (staffRole !== "No Access" && !canAccessTab(staffRole, activeTab)) {
      setActiveTab(getDefaultTabForRole(staffRole));
    }
  }, [staffRole, activeTab]);
  async function loadAllData(showLoader = false) {
    try {
      if (showLoader) setLoading(true);
      const [roomsRes, guestsRes, bookingsRes, paymentsRes, expensesRes, maintenanceRes, auditRes] = await Promise.all([
        supabase.from("rooms").select("*").order("room_number", { ascending: true }),
        supabase.from("guests").select("*").order("id", { ascending: false }),
        supabase.from("bookings").select("*").order("id", { ascending: false }),
        supabase.from("payments").select("*").order("id", { ascending: false }),
        supabase.from("motel_expenses").select("*").order("id", { ascending: false }),
        supabase.from("motel_maintenance").select("*").order("id", { ascending: false }),
        supabase.from("motel_audit_logs").select("*").order("id", { ascending: false }).limit(300),
      ]);
      if (roomsRes.error) throw roomsRes.error;
      if (guestsRes.error) throw guestsRes.error;
      if (bookingsRes.error) throw bookingsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (maintenanceRes.error) throw maintenanceRes.error;
      if (auditRes.error) throw auditRes.error;
      setRooms((roomsRes.data || []) as Room[]);
      setGuests((guestsRes.data || []) as Guest[]);
      setBookings((bookingsRes.data || []) as Booking[]);
      setPayments((paymentsRes.data || []) as Payment[]);
      setExpenses((expensesRes.data || []) as Expense[]);
      setMaintenanceJobs((maintenanceRes.data || []) as MaintenanceJob[]);
      setAuditLogs((auditRes.data || []) as AuditLog[]);
    } catch (error: any) {
      showToast(error.message || "Failed to load data.", "error");
    } finally {
      setLoading(false);
    }
  }
  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === Number(bookingForm.room_id)),
    [rooms, bookingForm.room_id]
  );
  const bookingDuration = useMemo(() => {
    return calculateDuration(
      selectedRoom?.billing_type,
      bookingForm.check_in_date,
      bookingForm.check_out_date
    );
  }, [selectedRoom, bookingForm.check_in_date, bookingForm.check_out_date]);
  const bookingRate = Number(selectedRoom?.price || 0);
  const bookingTotal = bookingDuration * bookingRate;
  const bookingCreatesImmediatePayment =
    bookingForm.payment_arrangement === "Pay Now" || bookingForm.payment_arrangement === "Part Payment";
  const bookingAmountPaidNow = bookingCreatesImmediatePayment ? Number(bookingForm.deposit || 0) : 0;
  const bookingBalance = Math.max(bookingTotal - bookingAmountPaidNow, 0);
  const bookingKeyDeposit = getKeyDepositRequiredByRoomType(selectedRoom?.room_type);
  const bookingViews: BookingView[] = useMemo(() => {
    return bookings.map((booking) => {
      const bookingPayments = payments.filter((payment) => payment.booking_id === booking.id);
      const roomPaid = bookingPayments
        .filter((payment) => isRoomRevenuePayment(payment))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const keyDepositPaid = bookingPayments
        .filter((payment) => isKeyDepositReceivedPayment(payment))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const keyDepositRefunded = bookingPayments
        .filter((payment) => isKeyDepositRefundPayment(payment))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const room = rooms.find((room) => room.id === booking.room_id);
      const linkedGuest = guests.find(
        (guest) =>
          normalize(guest.full_name) === normalize(booking.guest_name) &&
          normalize(guest.phone) === normalize(booking.phone)
      ) || guests.find((guest) => normalize(guest.full_name) === normalize(booking.guest_name));
      const keyDepositRequired = getKeyDepositRequiredByRoomType(room?.room_type);
      const keyDepositOutstanding = Math.max(keyDepositRequired - keyDepositPaid + keyDepositRefunded, 0);
      let keyDepositStatus = "Not Required";
      if (keyDepositRequired > 0 && keyDepositPaid <= 0) keyDepositStatus = "Pending";
      if (keyDepositRequired > 0 && keyDepositPaid > 0) keyDepositStatus = "Held";
      if (keyDepositRequired > 0 && keyDepositRefunded >= keyDepositPaid && keyDepositPaid > 0) keyDepositStatus = "Refunded";
      return {
        ...booking,
        paid: roomPaid,
        roomPaid,
        due: Math.max(Number(booking.total_amount || 0) - roomPaid, 0),
        keyDepositRequired,
        keyDepositPaid,
        keyDepositRefunded,
        keyDepositOutstanding,
        keyDepositStatus,
        guestEmail: linkedGuest?.email || null,
        room,
      };
    });
  }, [bookings, payments, rooms, guests]);

  const outstandingInvoices = useMemo(() => {
    return bookingViews
      .filter((booking) => Number(booking.due || 0) > 0 && booking.status !== "Cancelled")
      .map((booking) => ({
        ...booking,
        invoiceNumber: formatInvoiceNumber(booking.id),
        invoiceStatus: getInvoiceStatus(booking),
        amountDue: Number(booking.due || 0),
        issueDate: booking.created_at ? String(booking.created_at).split("T")[0] : todayDate(),
      }))
      .sort((a, b) => Number(b.amountDue || 0) - Number(a.amountDue || 0));
  }, [bookingViews]);

  const invoiceRegister = useMemo(() => {
    const q = normalize(invoiceSearch);
    return bookingViews
      .filter((booking) => booking.status !== "Cancelled")
      .map((booking) => ({
        ...booking,
        invoiceNumber: formatInvoiceNumber(booking.id),
        invoiceStatus: getInvoiceStatus(booking),
        amountDue: Number(booking.due || 0),
        issueDate: booking.created_at ? String(booking.created_at).split("T")[0] : todayDate(),
      }))
      .filter((invoice) => {
        const matchesSearch =
          !q ||
          normalize(invoice.invoiceNumber).includes(q) ||
          normalize(invoice.guest_name).includes(q) ||
          normalize(invoice.phone).includes(q) ||
          normalize(invoice.room_number).includes(q) ||
          normalize(invoice.status).includes(q);
        const matchesStatus = invoiceStatusFilter === "All" || invoice.invoiceStatus === invoiceStatusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  }, [bookingViews, invoiceSearch, invoiceStatusFilter]);

  const invoiceStats = useMemo(() => {
    const total = invoiceRegister.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
    const paid = invoiceRegister.reduce((sum, invoice) => sum + Number(invoice.roomPaid || 0), 0);
    const due = invoiceRegister.reduce((sum, invoice) => sum + Number(invoice.amountDue || 0), 0);
    return { total, paid, due, count: invoiceRegister.length };
  }, [invoiceRegister]);
  const selectedBooking = useMemo(
    () => bookingViews.find((booking) => booking.id === selectedBookingId) || null,
    [bookingViews, selectedBookingId]
  );
  const selectedBookingPayments = useMemo(() => {
    if (!selectedBookingId) return [];
    return payments
      .filter((payment) => payment.booking_id === selectedBookingId)
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [payments, selectedBookingId]);
  const checkedInBookings = useMemo(() => {
    return bookingViews.filter((booking) => booking.status === "Checked In");
  }, [bookingViews]);
  const checkedOutBookings = useMemo(() => {
    return bookingViews
      .filter((booking) => booking.status === "Checked Out")
      .sort((a, b) => String(b.check_out_date || "").localeCompare(String(a.check_out_date || "")));
  }, [bookingViews]);
  const recentCheckoutSummary = useMemo(() => {
    return checkedOutBookings.map((booking) => {
      const bookingPayments = payments.filter((payment) => payment.booking_id === booking.id);
      const checkoutPayment = bookingPayments
        .filter((payment) => isCheckOutPayment(payment))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const refundedDeposit = bookingPayments
        .filter((payment) => isKeyDepositRefundPayment(payment))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

      return {
        ...booking,
        finalCheckoutPayment: checkoutPayment,
        keyDepositRefundedAtCheckout: refundedDeposit,
        finalRoomPaid: Number(booking.roomPaid || 0),
        finalBalance: Math.max(Number(booking.total_amount || 0) - Number(booking.roomPaid || 0), 0),
      };
    });
  }, [checkedOutBookings, payments]);
  const checkoutReportStats = useMemo(() => {
    return {
      totalCheckouts: recentCheckoutSummary.length,
      checkoutRevenue: recentCheckoutSummary.reduce((sum, item) => sum + Number(item.finalCheckoutPayment || 0), 0),
      refundedDeposits: recentCheckoutSummary.reduce((sum, item) => sum + Number(item.keyDepositRefundedAtCheckout || 0), 0),
    };
  }, [recentCheckoutSummary]);
  const checkoutBooking = useMemo(() => {
    return checkedInBookings.find((booking) => booking.id === checkoutBookingId) || null;
  }, [checkedInBookings, checkoutBookingId]);
  useEffect(() => {
    if (!checkoutBooking) {
      setCheckoutFinalPayment("0");
      setCheckoutAdditionalCharges("0");
      setCheckoutNotes("");
      setCheckoutRefundKeyDeposit(true);
      setCheckoutRefundMethod("Cash");
      setCheckoutPaymentMethod("Cash");
      return;
    }
    setCheckoutFinalPayment(String(checkoutBooking.due || 0));
    setCheckoutAdditionalCharges("0");
    setCheckoutNotes("");
    setCheckoutRefundKeyDeposit((checkoutBooking.keyDepositPaid - checkoutBooking.keyDepositRefunded) > 0);
  }, [checkoutBookingId]);
  const linkedGuest = useMemo(() => {
    if (!selectedBooking) return null;
    return (
      guests.find(
        (guest) =>
          normalize(guest.full_name) === normalize(selectedBooking.guest_name) &&
          normalize(guest.phone) === normalize(selectedBooking.phone)
      ) ||
      guests.find((guest) => normalize(guest.full_name) === normalize(selectedBooking.guest_name)) ||
      null
    );
  }, [selectedBooking, guests]);
  const dashboardStats = useMemo(() => {
    const totalRevenue = payments.filter((payment) => isRoomRevenuePayment(payment)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const totalOutstanding = bookingViews.reduce((sum, booking) => sum + Number(booking.due || 0), 0);
    return {
      totalRooms: rooms.length,
      availableRooms: rooms.filter((r) => r.status === "Available").length,
      occupiedRooms: rooms.filter((r) => r.status === "Occupied").length,
      reservedRooms: rooms.filter((r) => r.status === "Reserved").length,
      cleaningRooms: rooms.filter((r) => r.status === "Cleaning").length,
      maintenanceRooms: rooms.filter((r) => r.status === "Maintenance").length,
      totalGuests: guests.length,
      totalBookings: bookings.length,
      totalPayments: payments.length,
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      totalOutstanding,
      totalAuditLogs: auditLogs.length,
    };
  }, [rooms, guests, bookings, payments, expenses, bookingViews, auditLogs]);
  const availableRooms = useMemo(() => {
    return rooms.filter(
      (room) =>
        room.status === "Available" ||
        room.status === "Reserved" ||
        room.id === Number(bookingForm.room_id)
    );
  }, [rooms, bookingForm.room_id]);
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesSearch =
        !roomSearch ||
        normalize(room.room_number).includes(normalize(roomSearch)) ||
        normalize(room.room_type).includes(normalize(roomSearch)) ||
        normalize(room.notes).includes(normalize(roomSearch));
      const matchesStatus =
        roomStatusFilter === "All" || room.status === roomStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rooms, roomSearch, roomStatusFilter]);
  const filteredGuests = useMemo(() => {
    return guests.filter((guest) => {
      const q = normalize(guestSearch);
      if (!q) return true;
      return (
        normalize(guest.full_name).includes(q) ||
        normalize(guest.phone).includes(q) ||
        normalize(guest.email).includes(q) ||
        normalize(guest.id_number).includes(q) ||
        normalize(guest.address).includes(q) ||
        normalize(guest.notes).includes(q)
      );
    });
  }, [guests, guestSearch]);
  const filteredBookings = useMemo(() => {
    return bookingViews.filter((booking) => {
      const matchesSearch =
        !bookingSearch ||
        normalize(booking.guest_name).includes(normalize(bookingSearch)) ||
        normalize(booking.phone).includes(normalize(bookingSearch)) ||
        normalize(booking.room_number).includes(normalize(bookingSearch)) ||
        normalize(booking.room?.room_type).includes(normalize(bookingSearch));
      const matchesStatus =
        bookingStatusFilter === "All" || booking.status === bookingStatusFilter;
      const matchesDate =
        !bookingDateFilter ||
        booking.check_in_date === bookingDateFilter ||
        booking.check_out_date === bookingDateFilter ||
        String(booking.created_at || "").slice(0, 10) === bookingDateFilter;
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [bookingViews, bookingSearch, bookingStatusFilter, bookingDateFilter]);
  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const booking = bookingViews.find((item) => item.id === payment.booking_id);
      const matchesSearch =
        !paymentSearch ||
        normalize(booking?.guest_name).includes(normalize(paymentSearch)) ||
        normalize(booking?.room_number).includes(normalize(paymentSearch)) ||
        normalize(payment.payment_method).includes(normalize(paymentSearch)) ||
        normalize(payment.amount).includes(normalize(paymentSearch));
      const matchesMethod =
        paymentMethodFilter === "All" || (payment.payment_method || "") === paymentMethodFilter;
      const matchesDate =
        !paymentDateFilter || (payment.payment_date || "") === paymentDateFilter;
      return matchesSearch && matchesMethod && matchesDate;
    });
  }, [payments, bookingViews, paymentSearch, paymentMethodFilter, paymentDateFilter]);
  const reportPayments = useMemo(() => {
    return payments.filter(
      (payment) =>
        isRoomRevenuePayment(payment) &&
        dateInRange(payment.payment_date || payment.created_at, reportStartDate, reportEndDate)
    );
  }, [payments, reportStartDate, reportEndDate]);
  const reportBookings = useMemo(() => {
    return bookingViews.filter(
      (booking) =>
        dateInRange(booking.check_in_date, reportStartDate, reportEndDate) ||
        dateInRange(booking.check_out_date, reportStartDate, reportEndDate) ||
        dateInRange(booking.created_at, reportStartDate, reportEndDate)
    );
  }, [bookingViews, reportStartDate, reportEndDate]);
  const reportStats = useMemo(() => {
    const revenue = reportPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const totalOutstanding = bookingViews.reduce((sum, booking) => sum + Number(booking.due || 0), 0);
    const paymentMethodTotals: Record<string, number> = {};
    reportPayments.forEach((payment) => {
      const key = payment.payment_method || "Unknown";
      paymentMethodTotals[key] = (paymentMethodTotals[key] || 0) + Number(payment.amount || 0);
    });
    return {
      revenue,
      totalPayments: reportPayments.length,
      totalBookings: reportBookings.length,
      checkedIn: bookingViews.filter((b) => b.status === "Checked In").length,
      checkedOutInRange: reportBookings.filter((b) => b.status === "Checked Out").length,
      reservedInRange: reportBookings.filter((b) => b.status === "Reserved").length,
      occupiedRooms: rooms.filter((r) => r.status === "Occupied").length,
      availableRooms: rooms.filter((r) => r.status === "Available").length,
      cleaningRooms: rooms.filter((r) => r.status === "Cleaning").length,
      maintenanceRooms: rooms.filter((r) => r.status === "Maintenance").length,
      totalOutstanding,
      outstandingBookings: bookingViews.filter((b) => Number(b.due || 0) > 0),
      paymentMethodTotals,
    };
  }, [reportPayments, reportBookings, bookingViews, rooms]);
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const q = normalize(expenseSearch);
      const matchesSearch =
        !q ||
        normalize(expense.category).includes(q) ||
        normalize(expense.description).includes(q) ||
        normalize(expense.payment_method).includes(q) ||
        normalize(expense.recorded_by).includes(q) ||
        normalize(expense.notes).includes(q);
      const matchesCategory =
        expenseCategoryFilter === "All" || (expense.category || "") === expenseCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [expenses, expenseSearch, expenseCategoryFilter]);

  const filteredMaintenanceJobs = useMemo(() => {
    return maintenanceJobs.filter((job) => {
      const q = normalize(maintenanceSearch);
      const matchesSearch =
        !q ||
        normalize(job.room_number).includes(q) ||
        normalize(job.issue_title).includes(q) ||
        normalize(job.issue_description).includes(q) ||
        normalize(job.priority).includes(q) ||
        normalize(job.status).includes(q) ||
        normalize(job.handled_by).includes(q) ||
        normalize(job.notes).includes(q);
      const matchesStatus =
        maintenanceStatusFilter === "All" || (job.status || "") === maintenanceStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [maintenanceJobs, maintenanceSearch, maintenanceStatusFilter]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const q = normalize(auditSearch);
      const matchesSearch =
        !q ||
        normalize(log.action_type).includes(q) ||
        normalize(log.table_name).includes(q) ||
        normalize(log.record_id).includes(q) ||
        normalize(log.description).includes(q) ||
        normalize(log.staff_email).includes(q);
      const matchesAction =
        auditActionFilter === "All" || (log.action_type || "") === auditActionFilter;
      return matchesSearch && matchesAction;
    });
  }, [auditLogs, auditSearch, auditActionFilter]);

  const reportExpenses = useMemo(() => {
    return expenses.filter((expense) =>
      dateInRange(expense.expense_date || expense.created_at, reportStartDate, reportEndDate)
    );
  }, [expenses, reportStartDate, reportEndDate]);

  const phase4Stats = useMemo(() => {
    const expenseTotal = reportExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const maintenanceCostTotal = maintenanceJobs.reduce((sum, job) => sum + Number(job.cost || 0), 0);
    const openMaintenance = maintenanceJobs.filter((job) => (job.status || "Open") !== "Completed").length;
    const netProfit = Number(reportStats.revenue || 0) - expenseTotal;
    return {
      expenseTotal,
      maintenanceCostTotal,
      openMaintenance,
      netProfit,
      allOutstandingBalance: bookingViews.reduce((sum, booking) => sum + Number(booking.due || 0), 0),
    };
  }, [reportExpenses, maintenanceJobs, reportStats.revenue, bookingViews]);

  const arrivalsToday = useMemo(() => {
    return bookingViews.filter(
      (b) => b.check_in_date === todayDate() && b.status !== "Cancelled"
    );
  }, [bookingViews]);
  const departuresToday = useMemo(() => {
    return bookingViews.filter(
      (b) => b.check_out_date === todayDate() && b.status !== "Cancelled"
    );
  }, [bookingViews]);
  const dueToday = useMemo(() => {
    return bookingViews.filter(
      (b) => Number(b.due || 0) > 0 && b.status !== "Cancelled"
    );
  }, [bookingViews]);
  const currentConflict = useMemo(() => {
    if (!selectedRoom || !bookingForm.check_in_date || !bookingForm.check_out_date) return null;
    return bookingViews.find((booking) => {
      if (booking.status === "Cancelled") return false;
      if (Number(booking.room_id) !== Number(selectedRoom.id)) return false;
      if (editingBookingId && booking.id === editingBookingId) return false;
      return overlaps(
        bookingForm.check_in_date,
        bookingForm.check_out_date,
        booking.check_in_date,
        booking.check_out_date
      );
    }) || null;
  }, [selectedRoom, bookingForm.check_in_date, bookingForm.check_out_date, bookingViews, editingBookingId]);
  function resetRoomForm() {
    setRoomForm({
      room_number: "",
      room_type: "Apartment",
      price: 399,
      billing_type: "Night",
      status: "Available",
      notes: "",
    });
    setEditingRoomId(null);
  }
  function resetGuestForm() {
    setGuestForm({
      full_name: "",
      phone: "",
      email: "",
      id_number: "",
      address: "",
      notes: "",
    });
    setEditingGuestId(null);
  }
  function resetBookingForm() {
    setBookingForm({
      guest_name: "",
      phone: "",
      room_id: 0,
      check_in_date: "",
      check_out_date: "",
      deposit: 0,
      status: "Reserved",
      notes: "",
      deposit_method: "Cash",
      payment_arrangement: "Reserve Only",
      organization_name: "",
      reference_no: "",
    });
    setEditingBookingId(null);
  }
  function resetPaymentForm() {
    setPaymentForm({
      booking_id: 0,
      amount: 0,
      payment_method: "Cash",
      payment_date: todayDate(),
    });
    setEditingPaymentId(null);
  }
  function resetExpenseForm() {
    setExpenseForm({
      expense_date: isoToday(),
      category: "Maintenance",
      description: "",
      amount: 0,
      payment_method: "Cash",
      recorded_by: "",
      notes: "",
    });
    setEditingExpenseId(null);
  }
  function resetMaintenanceForm() {
    setMaintenanceForm({
      room_id: 0,
      room_number: "",
      issue_title: "",
      issue_description: "",
      priority: "Normal",
      status: "Open",
      reported_date: isoToday(),
      completed_date: "",
      cost: 0,
      handled_by: "",
      notes: "",
    });
    setEditingMaintenanceId(null);
  }
  function clearRoomFilters() {
    setRoomSearch("");
    setRoomStatusFilter("All");
  }
  function clearGuestFilters() {
    setGuestSearch("");
  }
  function clearBookingFilters() {
    setBookingSearch("");
    setBookingStatusFilter("All");
    setBookingDateFilter("");
  }
  function clearPaymentFilters() {
    setPaymentSearch("");
    setPaymentMethodFilter("All");
    setPaymentDateFilter("");
  }
  function clearExpenseFilters() {
    setExpenseSearch("");
    setExpenseCategoryFilter("All");
  }
  function clearMaintenanceFilters() {
    setMaintenanceSearch("");
    setMaintenanceStatusFilter("All");
  }
  function clearAuditFilters() {
    setAuditSearch("");
    setAuditActionFilter("All");
  }
  function startEditRoom(room: Room) {
    setEditingRoomId(room.id);
    setRoomForm({
      room_number: room.room_number || "",
      room_type: room.room_type || "Apartment",
      price: Number(room.price || 0),
      billing_type: room.billing_type || "Night",
      status: room.status || "Available",
      notes: room.notes || "",
    });
    setActiveTab("rooms");
  }
  function startEditGuest(guest: Guest) {
    setEditingGuestId(guest.id);
    setGuestForm({
      full_name: guest.full_name || "",
      phone: guest.phone || "",
      email: guest.email || "",
      id_number: guest.id_number || "",
      address: guest.address || "",
      notes: guest.notes || "",
    });
    setActiveTab("guests");
  }
  function startEditBooking(booking: BookingView) {
    setEditingBookingId(booking.id);
    setBookingForm({
      guest_name: booking.guest_name || "",
      phone: booking.phone || "",
      room_id: Number(booking.room_id || 0),
      check_in_date: booking.check_in_date || "",
      check_out_date: booking.check_out_date || "",
      deposit: Number(booking.paid || 0),
      status: booking.status || "Reserved",
      notes: "",
      deposit_method: "Cash",
    });
    setActiveTab("bookings");
  }
  function startEditPayment(payment: Payment) {
    setEditingPaymentId(payment.id);
    setPaymentForm({
      booking_id: Number(payment.booking_id || 0),
      amount: Number(payment.amount || 0),
      payment_method: payment.payment_method || "Cash",
      payment_date: payment.payment_date || todayDate(),
    });
    setActiveTab("payments");
  }
  function startEditExpense(expense: Expense) {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      expense_date: expense.expense_date || isoToday(),
      category: expense.category || "Maintenance",
      description: expense.description || "",
      amount: Number(expense.amount || 0),
      payment_method: expense.payment_method || "Cash",
      recorded_by: expense.recorded_by || "",
      notes: expense.notes || "",
    });
    setActiveTab("expenses");
  }

  async function saveExpense() {
    try {
      if (!expenseForm.description.trim()) {
        showToast("Please enter expense description.", "error");
        return;
      }
      setBusy(true);
      const payload = {
        expense_date: expenseForm.expense_date || isoToday(),
        category: expenseForm.category || "General",
        description: expenseForm.description.trim(),
        amount: Number(expenseForm.amount || 0),
        payment_method: expenseForm.payment_method || "Cash",
        recorded_by: expenseForm.recorded_by || user?.email || null,
        notes: expenseForm.notes || null,
      };
      if (editingExpenseId) {
        const { error } = await supabase.from("motel_expenses").update(payload).eq("id", editingExpenseId);
        if (error) throw error;
        await logAudit("UPDATE", "motel_expenses", editingExpenseId, `Expense updated: ${payload.description} (${formatK(payload.amount)})`);
        showToast("Expense updated successfully.", "success");
      } else {
        const { error } = await supabase.from("motel_expenses").insert(payload);
        if (error) throw error;
        await logAudit("CREATE", "motel_expenses", "new", `Expense recorded: ${payload.description} (${formatK(payload.amount)})`);
        showToast("Expense saved successfully.", "success");
      }
      resetExpenseForm();
      await loadAllData();
      setActiveTab("expenses");
    } catch (error: any) {
      showToast(error.message || "Failed to save expense.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteExpense(expenseId: number) {
    if (!window.confirm("Delete this expense record?")) return;
    try {
      setBusy(true);
      const { error } = await supabase.from("motel_expenses").delete().eq("id", expenseId);
      if (error) throw error;
      if (editingExpenseId === expenseId) resetExpenseForm();
      await loadAllData();
      await logAudit("DELETE", "motel_expenses", expenseId, `Expense deleted: ID ${expenseId}`);
      showToast("Expense deleted.", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to delete expense.", "error");
    } finally {
      setBusy(false);
    }
  }

  function startEditMaintenance(job: MaintenanceJob) {
    setEditingMaintenanceId(job.id);
    const room = rooms.find((item) => item.room_number === job.room_number || item.id === job.room_id);
    setMaintenanceForm({
      room_id: Number(job.room_id || room?.id || 0),
      room_number: job.room_number || room?.room_number || "",
      issue_title: job.issue_title || "",
      issue_description: job.issue_description || "",
      priority: job.priority || "Normal",
      status: job.status || "Open",
      reported_date: job.reported_date || isoToday(),
      completed_date: job.completed_date || "",
      cost: Number(job.cost || 0),
      handled_by: job.handled_by || "",
      notes: job.notes || "",
    });
    setActiveTab("maintenance");
  }

  async function saveMaintenance() {
    try {
      if (!maintenanceForm.issue_title.trim()) {
        showToast("Please enter maintenance issue title.", "error");
        return;
      }
      const selectedMaintenanceRoom = rooms.find((room) => room.id === Number(maintenanceForm.room_id));
      setBusy(true);
      const payload = {
        room_id: selectedMaintenanceRoom?.id || null,
        room_number: selectedMaintenanceRoom?.room_number || maintenanceForm.room_number || null,
        issue_title: maintenanceForm.issue_title.trim(),
        issue_description: maintenanceForm.issue_description || null,
        priority: maintenanceForm.priority || "Normal",
        status: maintenanceForm.status || "Open",
        reported_date: maintenanceForm.reported_date || isoToday(),
        completed_date: maintenanceForm.status === "Completed" ? (maintenanceForm.completed_date || isoToday()) : (maintenanceForm.completed_date || null),
        cost: Number(maintenanceForm.cost || 0),
        handled_by: maintenanceForm.handled_by || null,
        notes: maintenanceForm.notes || null,
      };
      if (editingMaintenanceId) {
        const { error } = await supabase.from("motel_maintenance").update(payload).eq("id", editingMaintenanceId);
        if (error) throw error;
        await logAudit("UPDATE", "motel_maintenance", editingMaintenanceId, `Maintenance updated: ${payload.issue_title} for room ${payload.room_number || "-"}`);
        showToast("Maintenance record updated.", "success");
      } else {
        const { error } = await supabase.from("motel_maintenance").insert(payload);
        if (error) throw error;
        await logAudit("CREATE", "motel_maintenance", "new", `Maintenance opened: ${payload.issue_title} for room ${payload.room_number || "-"}`);
        showToast("Maintenance record saved.", "success");
      }
      if (selectedMaintenanceRoom?.id) {
        const roomStatus = payload.status === "Completed" ? "Available" : "Maintenance";
        await supabase.from("rooms").update({ status: roomStatus }).eq("id", selectedMaintenanceRoom.id);
      }
      resetMaintenanceForm();
      await loadAllData();
      setActiveTab("maintenance");
    } catch (error: any) {
      showToast(error.message || "Failed to save maintenance record.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteMaintenance(jobId: number) {
    if (!window.confirm("Delete this maintenance record?")) return;
    try {
      setBusy(true);
      const { error } = await supabase.from("motel_maintenance").delete().eq("id", jobId);
      if (error) throw error;
      if (editingMaintenanceId === jobId) resetMaintenanceForm();
      await loadAllData();
      await logAudit("DELETE", "motel_maintenance", jobId, `Maintenance record deleted: ID ${jobId}`);
      showToast("Maintenance record deleted.", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to delete maintenance record.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleAuth() {
    try {
      if (!authForm.email || !authForm.password) {
        showToast("Please enter email and password.", "error");
        return;
      }
      setBusy(true);
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: authForm.email,
          password: authForm.password,
          options: {
            data: {
              full_name: authForm.full_name || "",
            },
          },
        });
        if (error) throw error;
        showToast("Signup successful. Check email confirmation if enabled.", "success");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password,
        });
        if (error) throw error;
        showToast("Login successful.", "success");
      }
    } catch (error: any) {
      showToast(error.message || "Authentication failed.", "error");
    } finally {
      setBusy(false);
    }
  }
  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    setStaffProfile(null);
    setStaffRole("No Access");
    setMessage("");
  }
  async function saveRoom() {
    try {
      if (!roomForm.room_number.trim()) {
        showToast("Please enter room number.", "error");
        return;
      }
      setBusy(true);
      if (editingRoomId) {
        const { error } = await supabase
          .from("rooms")
          .update({
            room_number: roomForm.room_number.trim(),
            room_type: roomForm.room_type,
            price: Number(roomForm.price || 0),
            billing_type: roomForm.billing_type,
            status: roomForm.status,
            notes: roomForm.notes || null,
          })
          .eq("id", editingRoomId);
        if (error) throw error;
        await logAudit("UPDATE", "rooms", editingRoomId, `Room updated: ${roomForm.room_number.trim()}`);
        showToast("Room updated successfully.", "success");
      } else {
        const { error } = await supabase.from("rooms").insert({
          room_number: roomForm.room_number.trim(),
          room_type: roomForm.room_type,
          price: Number(roomForm.price || 0),
          billing_type: roomForm.billing_type,
          status: roomForm.status,
          notes: roomForm.notes || null,
        });
        if (error) throw error;
        await logAudit("CREATE", "rooms", roomForm.room_number.trim(), `Room created: ${roomForm.room_number.trim()}`);
        showToast("Room saved successfully.", "success");
      }
      resetRoomForm();
      await loadAllData();
      setActiveTab("rooms");
    } catch (error: any) {
      showToast(error.message || "Failed to save room.", "error");
    } finally {
      setBusy(false);
    }
  }
  async function deleteRoom(roomId: number) {
    if (!window.confirm("Delete this room?")) return;
    try {
      setBusy(true);
      const { error } = await supabase.from("rooms").delete().eq("id", roomId);
      if (error) throw error;
      if (editingRoomId === roomId) resetRoomForm();
      await loadAllData();
      await logAudit("DELETE", "rooms", roomId, `Room deleted: ID ${roomId}`);
      showToast("Room deleted.", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to delete room.", "error");
    } finally {
      setBusy(false);
    }
  }
  async function updateRoomStatus(roomId: number, status: RoomStatus) {
    try {
      setBusy(true);
      const { error } = await supabase
        .from("rooms")
        .update({ status })
        .eq("id", roomId);
      if (error) throw error;
      await loadAllData();
      await logAudit("UPDATE", "rooms", roomId, `Room status changed to ${status}`);
      showToast("Room status updated.", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to update room status.", "error");
    } finally {
      setBusy(false);
    }
  }
  async function saveGuest() {
    try {
      if (!guestForm.full_name.trim()) {
        showToast("Please enter guest name.", "error");
        return;
      }
      setBusy(true);
      const payload = {
        full_name: guestForm.full_name.trim(),
        phone: guestForm.phone || null,
        email: guestForm.email || null,
        id_number: guestForm.id_number || null,
        address: guestForm.address || null,
        notes: guestForm.notes || null,
      };
      if (editingGuestId) {
        const { error } = await supabase
          .from("guests")
          .update(payload)
          .eq("id", editingGuestId);
        if (error) throw error;
        await logAudit("UPDATE", "guests", editingGuestId, `Guest updated: ${payload.full_name}`);
        showToast("Guest updated successfully.", "success");
      } else {
        const { error } = await supabase.from("guests").insert(payload);
        if (error) throw error;
        await logAudit("CREATE", "guests", payload.full_name, `Guest created: ${payload.full_name}`);
        showToast("Guest saved successfully.", "success");
      }
      resetGuestForm();
      await loadAllData();
      setActiveTab("guests");
    } catch (error: any) {
      showToast(error.message || "Failed to save guest.", "error");
    } finally {
      setBusy(false);
    }
  }
  async function deleteGuest(guestId: number) {
    if (!window.confirm("Delete this guest?")) return;
    try {
      setBusy(true);
      const { error } = await supabase.from("guests").delete().eq("id", guestId);
      if (error) throw error;
      if (editingGuestId === guestId) resetGuestForm();
      await loadAllData();
      await logAudit("DELETE", "guests", guestId, `Guest deleted: ID ${guestId}`);
      showToast("Guest deleted.", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to delete guest.", "error");
    } finally {
      setBusy(false);
    }
  }

  function generateReceiptNumberForBooking(bookingId: number | string | null | undefined) {
    return `RCPT-${String(bookingId || 0).padStart(6, "0")}-${Date.now().toString().slice(-5)}`;
  }

  function generateInvoiceNumberForBooking(bookingId: number | string | null | undefined) {
    return `INV-${String(bookingId || 0).padStart(6, "0")}-${Date.now().toString().slice(-5)}`;
  }

  async function insertPaymentWithReceipt(payload: any) {
    const receiptPayload = {
      receipt_number: payload.receipt_number || generateReceiptNumberForBooking(payload.booking_id),
      ...payload,
    };

    const { error } = await supabase.from("payments").insert(receiptPayload);
    if (!error) return;

    const message = String(error.message || "").toLowerCase();
    if (message.includes("receipt_number") || message.includes("column")) {
      const { receipt_number, ...payloadWithoutReceiptNumber } = receiptPayload;
      const retry = await supabase.from("payments").insert(payloadWithoutReceiptNumber);
      if (retry.error) throw retry.error;
      return;
    }

    throw error;
  }

  async function createFinalInvoiceRecord(booking: BookingView, totalAmount: number, paidAmount: number, balance: number) {
    const invoicePayload = {
      booking_id: booking.id,
      invoice_number: generateInvoiceNumberForBooking(booking.id),
      guest_name: booking.guest_name,
      room_number: booking.room_number || "-",
      invoice_date: todayDate(),
      stay_from: booking.check_in_date,
      stay_to: booking.check_out_date,
      subtotal: totalAmount,
      tax: 0,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      balance,
      status: balance > 0 ? "Part Paid" : "Paid",
      notes: "Auto-created at check-out",
    };

    const first = await supabase.from("invoices").insert(invoicePayload);
    if (!first.error) return;

    const firstMessage = String(first.error.message || "").toLowerCase();
    if (firstMessage.includes("relation") || firstMessage.includes("does not exist")) {
      const second = await supabase.from("motel_invoices").insert(invoicePayload);
      if (second.error) console.warn("Invoice ledger insert skipped:", second.error.message);
      return;
    }

    console.warn("Invoice ledger insert skipped:", first.error.message);
  }

  async function saveBooking() {
    try {
      if (!bookingForm.guest_name.trim()) {
        showToast("Please enter guest name.", "error");
        return;
      }
      if (!selectedRoom) {
        showToast("Please select a room.", "error");
        return;
      }
      if (!bookingForm.check_in_date || !bookingForm.check_out_date) {
        showToast("Please enter check-in and check-out dates.", "error");
        return;
      }
      if (bookingForm.check_out_date <= bookingForm.check_in_date) {
        showToast("Check-out date must be after check-in date.", "error");
        return;
      }
      if (currentConflict) {
        showToast(
          `Room ${selectedRoom.room_number} is already booked for overlapping dates by ${currentConflict.guest_name}.`,
          "error"
        );
        return;
      }
      setBusy(true);

      // Server-side double-booking prevention. This protects the system even if the screen data is old.
      const { data: existingBookings, error: conflictCheckError } = await supabase
        .from("bookings")
        .select("id, guest_name, check_in_date, check_out_date, status")
        .eq("room_id", selectedRoom.id)
        .in("status", ["Reserved", "Checked In"]);
      if (conflictCheckError) throw conflictCheckError;
      const serverConflict = (existingBookings || []).find((booking: any) => {
        if (editingBookingId && Number(booking.id) === Number(editingBookingId)) return false;
        return overlaps(
          bookingForm.check_in_date,
          bookingForm.check_out_date,
          booking.check_in_date,
          booking.check_out_date
        );
      });
      if (serverConflict) {
        showToast(
          `Room ${selectedRoom.room_number} is already booked for overlapping dates by ${serverConflict.guest_name}.`,
          "error"
        );
        return;
      }

      if (editingBookingId) {
        const currentBooking = bookingViews.find((item) => item.id === editingBookingId);
        const paidAlready = currentBooking?.paid || 0;
        const finalBalance = Math.max(bookingTotal - paidAlready, 0);
        const { error: bookingError } = await supabase
          .from("bookings")
          .update({
            guest_name: bookingForm.guest_name.trim(),
            phone: bookingForm.phone || null,
            room_id: selectedRoom.id,
            room_number: selectedRoom.room_number,
            room_type: selectedRoom.room_type,
            billing_type: selectedRoom.billing_type,
            nights_or_months: bookingDuration,
            rate: bookingRate,
            check_in_date: bookingForm.check_in_date,
            check_out_date: bookingForm.check_out_date,
            total_amount: bookingTotal,
            deposit: paidAlready,
            balance: finalBalance,
            status: bookingForm.status,
          })
          .eq("id", editingBookingId);
        if (bookingError) throw bookingError;
        const { error: roomError } = await supabase
          .from("rooms")
          .update({ status: getRoomStatusFromBooking(bookingForm.status) })
          .eq("id", selectedRoom.id);
        if (roomError) throw roomError;
        await logAudit("UPDATE", "bookings", editingBookingId, `Booking updated for ${bookingForm.guest_name.trim()} room ${selectedRoom.room_number}`);
        showToast("Booking updated successfully.", "success");
      } else {
        const bookingReference = generateBookingReference();
        const newBookingPayload: any = {
          booking_reference: bookingReference,
          guest_name: bookingForm.guest_name.trim(),
          phone: bookingForm.phone || null,
          room_id: selectedRoom.id,
          room_number: selectedRoom.room_number,
          room_type: selectedRoom.room_type,
          billing_type: selectedRoom.billing_type,
          nights_or_months: bookingDuration || calculateNights(bookingForm.check_in_date, bookingForm.check_out_date),
          rate: bookingRate,
          check_in_date: bookingForm.check_in_date,
          check_out_date: bookingForm.check_out_date,
          total_amount: bookingTotal,
          deposit: bookingAmountPaidNow,
          balance: bookingBalance,
          status: bookingForm.status,
        };

        let bookingData: any = null;
        let bookingError: any = null;
        const insertWithReference = await supabase
          .from("bookings")
          .insert(newBookingPayload)
          .select()
          .single();

        bookingData = insertWithReference.data;
        bookingError = insertWithReference.error;

        // Compatibility fallback: if your existing bookings table does not yet have booking_reference,
        // the system still saves the booking instead of breaking. We can add that column in the next SQL patch.
        if (bookingError && String(bookingError.message || "").toLowerCase().includes("booking_reference")) {
          const { booking_reference, ...payloadWithoutReference } = newBookingPayload;
          const retryInsert = await supabase
            .from("bookings")
            .insert(payloadWithoutReference)
            .select()
            .single();
          bookingData = retryInsert.data;
          bookingError = retryInsert.error;
        }

        if (bookingError) throw bookingError;
        const roomStatus = getRoomStatusFromBooking(bookingForm.status);
        const { error: roomError } = await supabase
          .from("rooms")
          .update({ status: roomStatus })
          .eq("id", selectedRoom.id);
        if (roomError) throw roomError;
        const existingGuest = guests.find(
          (guest) =>
            guest.full_name?.toLowerCase() === bookingForm.guest_name.trim().toLowerCase() &&
            (guest.phone || "") === (bookingForm.phone || "")
        );
        if (!existingGuest) {
          await supabase.from("guests").insert({
            full_name: bookingForm.guest_name.trim(),
            phone: bookingForm.phone || null,
            notes: bookingForm.notes
              ? `Auto-created from booking. ${bookingForm.notes}`
              : "Auto-created from booking.",
          });
        }
        if (bookingCreatesImmediatePayment && Number(bookingForm.deposit) > 0 && bookingData?.id) {
          await insertPaymentWithReceipt({
            booking_id: bookingData.id,
            guest_name: bookingForm.guest_name.trim(),
            room_number: selectedRoom.room_number,
            amount: Number(bookingForm.deposit),
            payment_method: bookingForm.deposit_method || "Cash",
            payment_date: todayDate(),
            notes: "Initial booking deposit",
          });
        }
        await logAudit("CREATE", "bookings", bookingData?.id || bookingReference, `Booking created for ${bookingForm.guest_name.trim()} room ${selectedRoom.room_number}`);
        showToast("Booking saved successfully.", "success");
      }
      resetBookingForm();
      await loadAllData();
      setActiveTab("bookings");
    } catch (error: any) {
      showToast(error.message || "Failed to save booking.", "error");
    } finally {
      setBusy(false);
    }
  }
  async function deleteBooking(bookingId: number, roomId: number | null) {
    if (!window.confirm("Delete this booking?")) return;
    try {
      setBusy(true);
      const { error: paymentError } = await supabase.from("payments").delete().eq("booking_id", bookingId);
      if (paymentError) throw paymentError;
      const { error } = await supabase.from("bookings").delete().eq("id", bookingId);
      if (error) throw error;
      if (roomId) {
        await supabase.from("rooms").update({ status: "Available" }).eq("id", roomId);
      }
      if (editingBookingId === bookingId) resetBookingForm();
      if (selectedBookingId === bookingId) setSelectedBookingId(null);
      await loadAllData();
      await logAudit("DELETE", "bookings", bookingId, `Booking deleted: ID ${bookingId}`);
      showToast("Booking deleted.", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to delete booking.", "error");
    } finally {
      setBusy(false);
    }
  }
  async function changeBookingStatus(bookingId: number, roomId: number | null, status: BookingStatus) {
    try {
      setBusy(true);
      const currentBooking = bookingViews.find((item) => item.id === bookingId);
      const baseUpdate: any = {
        status,
        balance: Math.max(Number(currentBooking?.total_amount || 0) - Number(currentBooking?.paid || 0), 0),
        deposit: Number(currentBooking?.paid || 0),
      };

      const timedUpdate: any = { ...baseUpdate };
      if (status === "Checked In") timedUpdate.check_in_time = new Date().toISOString();
      if (status === "Checked Out") timedUpdate.check_out_time = new Date().toISOString();

      let bookingUpdate = await supabase
        .from("bookings")
        .update(timedUpdate)
        .eq("id", bookingId);

      if (bookingUpdate.error) {
        const message = String(bookingUpdate.error.message || "").toLowerCase();
        if (message.includes("check_in_time") || message.includes("check_out_time") || message.includes("column")) {
          bookingUpdate = await supabase
            .from("bookings")
            .update(baseUpdate)
            .eq("id", bookingId);
        }
      }

      if (bookingUpdate.error) throw bookingUpdate.error;

      if (roomId) {
        const { error: roomError } = await supabase
          .from("rooms")
          .update({ status: getRoomStatusFromBooking(status) })
          .eq("id", roomId);
        if (roomError) throw roomError;
      }

      await logAudit("STATUS", "bookings", bookingId, `Booking status changed to ${status}`);

      if (status === "Checked In") {
        showToast("Guest checked in successfully. Room is now occupied.", "success");
      } else if (status === "Checked Out") {
        showToast("Guest checked out successfully. Room is now available.", "success");
      } else {
        showToast("Booking status updated.", "success");
      }

      await loadAllData();
    } catch (error: any) {
      showToast(error.message || "Failed to update booking status.", "error");
    } finally {
      setBusy(false);
    }
  }
  async function savePayment() {
    try {
      const booking = bookingViews.find((item) => item.id === Number(paymentForm.booking_id));
      if (!booking) {
        showToast("Please select a booking.", "error");
        return;
      }
      if (Number(paymentForm.amount) <= 0) {
        showToast("Please enter a valid payment amount.", "error");
        return;
      }
      setBusy(true);
      let adjustment = Number(paymentForm.amount);
      if (editingPaymentId) {
        const oldPayment = payments.find((item) => item.id === editingPaymentId);
        const oldAmount = Number(oldPayment?.amount || 0);
        const { error: paymentError } = await supabase
          .from("payments")
          .update({
            booking_id: booking.id,
            guest_name: booking.guest_name,
            room_number: booking.room_number || "-",
            amount: Number(paymentForm.amount),
            payment_method: paymentForm.payment_method || "Cash",
            payment_date: paymentForm.payment_date || todayDate(),
          })
          .eq("id", editingPaymentId);
        if (paymentError) throw paymentError;
        adjustment = Number(paymentForm.amount) - oldAmount;
        await logAudit("UPDATE", "payments", editingPaymentId, `Payment updated for ${booking.guest_name}: ${formatK(paymentForm.amount)}`);
        showToast("Payment updated successfully.", "success");
      } else {
        await insertPaymentWithReceipt({
          booking_id: booking.id,
          guest_name: booking.guest_name,
          room_number: booking.room_number || "-",
          amount: Number(paymentForm.amount),
          payment_method: paymentForm.payment_method || "Cash",
          payment_date: paymentForm.payment_date || todayDate(),
          notes: "Room payment",
        });
        await logAudit("CREATE", "payments", booking.id, `Payment recorded for ${booking.guest_name}: ${formatK(paymentForm.amount)}`);
        showToast("Payment recorded successfully.", "success");
      }
      const newPaid = booking.paid + adjustment;
      const newBalance = Math.max(Number(booking.total_amount || 0) - newPaid, 0);
      const { error: bookingError } = await supabase
        .from("bookings")
        .update({
          deposit: newPaid,
          balance: newBalance,
        })
        .eq("id", booking.id);
      if (bookingError) throw bookingError;
      resetPaymentForm();
      await loadAllData();
      setActiveTab("payments");
    } catch (error: any) {
      showToast(error.message || "Failed to save payment.", "error");
    } finally {
      setBusy(false);
    }
  }
  async function quickPayBooking(booking: BookingView) {
    const due = Number(booking.due || 0);
    const defaultAmount = due > 0 ? String(due) : "";
    const input = window.prompt(
      `Enter payment amount for ${booking.guest_name} (${booking.room_number || "Room"})`,
      defaultAmount
    );

    if (input === null) return;

    const amount = Number(input);
    if (!amount || amount <= 0) {
      showToast("Please enter a valid payment amount.", "error");
      return;
    }

    try {
      setBusy(true);

      await insertPaymentWithReceipt({
        booking_id: booking.id,
        guest_name: booking.guest_name,
        room_number: booking.room_number || "-",
        amount,
        payment_method: "Cash",
        payment_date: todayDate(),
        notes: "Quick payment from booking card",
      });

      const newPaid = Number(booking.paid || 0) + amount;
      const newBalance = Math.max(Number(booking.total_amount || 0) - newPaid, 0);

      const { error: bookingError } = await supabase
        .from("bookings")
        .update({
          deposit: newPaid,
          balance: newBalance,
        })
        .eq("id", booking.id);

      if (bookingError) throw bookingError;

      await loadAllData();
      await logAudit("CREATE", "payments", booking.id, `Quick payment recorded for ${booking.guest_name}: ${formatK(amount)}`);
      showToast("Payment recorded from booking card.", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to record quick payment.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function deletePayment(paymentId: number, bookingId: number) {
    if (!window.confirm("Delete this payment?")) return;
    try {
      setBusy(true);
      const payment = payments.find((item) => item.id === paymentId);
      const booking = bookingViews.find((item) => item.id === bookingId);
      const { error } = await supabase.from("payments").delete().eq("id", paymentId);
      if (error) throw error;
      if (booking) {
        const newPaid = Math.max(Number(booking.paid || 0) - Number(payment?.amount || 0), 0);
        const newBalance = Math.max(Number(booking.total_amount || 0) - newPaid, 0);
        await supabase
          .from("bookings")
          .update({
            deposit: newPaid,
            balance: newBalance,
          })
          .eq("id", booking.id);
      }
      if (editingPaymentId === paymentId) resetPaymentForm();
      await loadAllData();
      await logAudit("DELETE", "payments", paymentId, `Payment deleted: ID ${paymentId}`);
      showToast("Payment deleted.", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to delete payment.", "error");
    } finally {
      setBusy(false);
    }
  }
  async function recordKeyDeposit(bookingId: number, amount: number, action: "received" | "refunded") {
    try {
      const booking = bookingViews.find((item) => item.id === bookingId);
      if (!booking) {
        showToast("Booking not found.", "error");
        return;
      }
      const suggested = action === "received"
        ? Math.max(booking.keyDepositRequired - booking.keyDepositPaid + booking.keyDepositRefunded, 0)
        : Math.max(booking.keyDepositPaid - booking.keyDepositRefunded, 0);
      if (suggested <= 0) {
        showToast(action === "received" ? "Key deposit already fully recorded." : "No key deposit left to refund.", "info");
        return;
      }
      const enteredAmount = window.prompt(
        action === "received" ? "Enter key deposit amount received" : "Enter key deposit amount to refund",
        String(amount || suggested)
      );
      if (!enteredAmount) return;
      const finalAmount = Number(enteredAmount);
      if (Number.isNaN(finalAmount) || finalAmount <= 0) {
        showToast("Please enter a valid key deposit amount.", "error");
        return;
      }
      const method = window.prompt(
        action === "received" ? "Enter payment method for key deposit" : "Enter refund method for key deposit",
        "Cash"
      ) || "Cash";
      setBusy(true);
      await insertPaymentWithReceipt({
        booking_id: booking.id,
        guest_name: booking.guest_name,
        room_number: booking.room_number || "-",
        amount: finalAmount,
        payment_method: method,
        payment_date: todayDate(),
        notes: getKeyDepositMethodLabel(action, method),
      });
      await loadAllData();
      await logAudit(action === "received" ? "KEY_DEPOSIT_RECEIVED" : "KEY_DEPOSIT_REFUNDED", "payments", booking.id, `${action === "received" ? "Key deposit recorded" : "Key deposit refunded"} for ${booking.guest_name}: ${formatK(finalAmount)}`);
      showToast(action === "received" ? "Key deposit recorded." : "Key deposit refunded.", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to update key deposit.", "error");
    } finally {
      setBusy(false);
    }
  }
  function openEmailReceipt(bookingId: number) {
    const booking = bookingViews.find((item) => item.id === bookingId);
    if (!booking) {
      showToast("Booking not found.", "error");
      return;
    }
    const guest = guests.find(
      (item) =>
        normalize(item.full_name) === normalize(booking.guest_name) &&
        normalize(item.phone) === normalize(booking.phone)
    ) || guests.find((item) => normalize(item.full_name) === normalize(booking.guest_name));
    const to = guest?.email || booking.guestEmail || "";
    if (!to) {
      showToast("No guest email found for this booking.", "error");
      return;
    }
    const subject = `${RECEIPT_BUSINESS.name} Receipt - ${booking.guest_name}`;
    const body = [
      `${RECEIPT_BUSINESS.name}`,
      `${RECEIPT_BUSINESS.organization}`,
      `${RECEIPT_BUSINESS.address1}`,
      `${RECEIPT_BUSINESS.address2}`,
      `Office/Mobile: ${RECEIPT_BUSINESS.phones}`,
      `Website: ${RECEIPT_BUSINESS.website}`,
      "",
      `Guest: ${booking.guest_name}`,
      `Phone: ${booking.phone || "-"}`,
      `Email: ${to}`,
      `Room: ${booking.room_number || "-"}`,
      `Check In: ${booking.check_in_date}`,
      `Check Out: ${booking.check_out_date}`,
      `Status: ${booking.status}`,
      `Total Room Charges: ${formatK(booking.total_amount)}`,
      `Room Payments Received: ${formatK(booking.roomPaid)}`,
      `Room Balance Due: ${formatK(booking.due)}`,
      `Key Deposit Required: ${formatK(booking.keyDepositRequired)}`,
      `Key Deposit Received: ${formatK(booking.keyDepositPaid)}`,
      `Key Deposit Refunded: ${formatK(booking.keyDepositRefunded)}`,
      `Key Deposit Status: ${booking.keyDepositStatus}`,
      "",
      `Thank you for staying with ${RECEIPT_BUSINESS.name}.`,
    ].join("\n");
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  function printInvoice(bookingId: number) {
    const booking = bookingViews.find((item) => item.id === bookingId);
    if (!booking) {
      showToast("Booking not found.", "error");
      return;
    }
    const guest = guests.find(
      (item) =>
        normalize(item.full_name) === normalize(booking.guest_name) &&
        normalize(item.phone) === normalize(booking.phone)
    ) || guests.find((item) => normalize(item.full_name) === normalize(booking.guest_name));
    const invoiceWindow = window.open("", "_blank", "width=900,height=700");
    if (!invoiceWindow) {
      showToast("Pop-up blocked. Allow pop-ups to print invoice.", "error");
      return;
    }
    invoiceWindow.document.write(`
      <html>
        <head>
          <title>${RECEIPT_BUSINESS.name} Invoice - ${booking.guest_name}</title>
        </head>
        <body style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
          <div style="max-width:820px;margin:0 auto;background:#fff;border:1px solid #dbe3ef;border-radius:20px;padding:28px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;">
              <div style="display:flex;gap:14px;">
                <img src="${RECEIPT_BUSINESS.logo}" alt="Logo" style="width:68px;height:68px;object-fit:contain;border-radius:12px;border:1px solid #dbe3ef;background:#fff;padding:4px;" />
                <div>
                  <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#4f46e5;text-transform:uppercase;">Tax / Service Invoice</div>
                  <h1 style="margin:8px 0 4px;font-size:30px;">${RECEIPT_BUSINESS.name}</h1>
                  <p style="margin:0;color:#475569;">${RECEIPT_BUSINESS.organization}</p>
                  <p style="margin:6px 0 0;color:#475569;">${RECEIPT_BUSINESS.address1}</p>
                  <p style="margin:4px 0 0;color:#475569;">${RECEIPT_BUSINESS.address2}</p>
                  <p style="margin:4px 0 0;color:#475569;">Office/Mobile: ${RECEIPT_BUSINESS.phones}</p>
                  <p style="margin:4px 0 0;color:#475569;">Website: ${RECEIPT_BUSINESS.website}</p>
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:12px;color:#64748b;">Invoice Number</div>
                <div style="font-size:18px;font-weight:800;">${formatInvoiceNumber(booking.id)}</div>
                <div style="margin-top:10px;font-size:12px;color:#64748b;">Issue Date</div>
                <div style="font-size:16px;font-weight:700;">${booking.created_at ? String(booking.created_at).slice(0,10) : todayDate()}</div>
              </div>
            </div>

            <div style="margin-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:18px;">
              <div style="padding:16px;border:1px solid #dbe3ef;border-radius:14px;background:#f8fafc;">
                <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Bill To</div>
                <div style="margin-top:8px;font-size:18px;font-weight:700;">${booking.guest_name}</div>
                <div style="margin-top:6px;color:#475569;">Phone: ${booking.phone || "-"}</div>
                <div style="margin-top:6px;color:#475569;">Email: ${guest?.email || booking.guestEmail || "-"}</div>
              </div>
              <div style="padding:16px;border:1px solid #dbe3ef;border-radius:14px;background:#f8fafc;">
                <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Stay Details</div>
                <div style="margin-top:8px;color:#475569;">Room: ${booking.room_number || "-"}</div>
                <div style="margin-top:6px;color:#475569;">Room Type: ${booking.room?.room_type || "-"}</div>
                <div style="margin-top:6px;color:#475569;">Stay Period: ${booking.check_in_date} to ${booking.check_out_date}</div>
                <div style="margin-top:6px;color:#475569;">Status: ${booking.status}</div>
              </div>
            </div>

            <div style="margin-top:24px;">
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:#eef2ff;">
                    <th style="padding:10px;border:1px solid #dbe3ef;text-align:left;">Description</th>
                    <th style="padding:10px;border:1px solid #dbe3ef;text-align:right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:10px;border:1px solid #dbe3ef;">Accommodation Charges</td>
                    <td style="padding:10px;border:1px solid #dbe3ef;text-align:right;">${formatK(booking.total_amount)}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px;border:1px solid #dbe3ef;">Payments Received To Date</td>
                    <td style="padding:10px;border:1px solid #dbe3ef;text-align:right;">-${formatK(booking.roomPaid)}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px;border:1px solid #dbe3ef;">Outstanding Amount</td>
                    <td style="padding:10px;border:1px solid #dbe3ef;text-align:right;font-weight:800;">${formatK(booking.due)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style="margin-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:18px;">
              <div style="padding:16px;border:1px solid #dbe3ef;border-radius:14px;">
                <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Invoice Status</div>
                <div style="margin-top:8px;font-size:20px;font-weight:800;">${getInvoiceStatus(booking)}</div>
              </div>
              <div style="padding:16px;border:1px solid #dbe3ef;border-radius:14px;background:#f8fafc;">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total Charges</span><strong>${formatK(booking.total_amount)}</strong></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Paid</span><strong>${formatK(booking.roomPaid)}</strong></div>
                <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;"><span>Balance Due</span><strong>${formatK(booking.due)}</strong></div>
              </div>
            </div>

            <div style="margin-top:24px;padding-top:16px;border-top:1px solid #dbe3ef;text-align:center;color:#64748b;font-size:13px;">
              Please quote invoice number ${formatInvoiceNumber(booking.id)} when making payment.
            </div>
          </div>
          <script>window.onload=function(){window.print();};</script>
        </body>
      </html>
    `);
    invoiceWindow.document.close();
  }
  function openEmailInvoice(bookingId: number) {
    const booking = bookingViews.find((item) => item.id === bookingId);
    if (!booking) {
      showToast("Booking not found.", "error");
      return;
    }
    const guest = guests.find(
      (item) =>
        normalize(item.full_name) === normalize(booking.guest_name) &&
        normalize(item.phone) === normalize(booking.phone)
    ) || guests.find((item) => normalize(item.full_name) === normalize(booking.guest_name));
    const to = guest?.email || booking.guestEmail || "";
    if (!to) {
      showToast("No guest email found for this booking.", "error");
      return;
    }
    const subject = `${RECEIPT_BUSINESS.name} Invoice ${formatInvoiceNumber(booking.id)} - ${booking.guest_name}`;
    const body = [
      `${RECEIPT_BUSINESS.name}`,
      `${RECEIPT_BUSINESS.organization}`,
      `${RECEIPT_BUSINESS.address1}`,
      `${RECEIPT_BUSINESS.address2}`,
      `Office/Mobile: ${RECEIPT_BUSINESS.phones}`,
      `Website: ${RECEIPT_BUSINESS.website}`,
      "",
      `Invoice Number: ${formatInvoiceNumber(booking.id)}`,
      `Guest: ${booking.guest_name}`,
      `Room: ${booking.room_number || "-"}`,
      `Stay Period: ${booking.check_in_date} to ${booking.check_out_date}`,
      `Total Charges: ${formatK(booking.total_amount)}`,
      `Payments Received: ${formatK(booking.roomPaid)}`,
      `Outstanding Balance: ${formatK(booking.due)}`,
      `Invoice Status: ${getInvoiceStatus(booking)}`,
      "",
      `Please quote invoice number ${formatInvoiceNumber(booking.id)} when making payment.`,
    ].join("\n");
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  async function processCheckout() {
    try {
      if (!checkoutBooking) {
        showToast("Please select a checked-in booking.", "error");
        return;
      }
      setBusy(true);
      const finalPaymentAmount = Math.max(Number(checkoutFinalPayment || 0), 0);
      const additionalCharges = Math.max(Number(checkoutAdditionalCharges || 0), 0);
      const adjustedTotalAmount = Number(checkoutBooking.total_amount || 0) + additionalCharges;
      let newRoomPaid = Number(checkoutBooking.roomPaid || 0);
      if (finalPaymentAmount > 0) {
        await insertPaymentWithReceipt({
          booking_id: checkoutBooking.id,
          guest_name: checkoutBooking.guest_name,
          room_number: checkoutBooking.room_number || "-",
          amount: finalPaymentAmount,
          payment_method: checkoutPaymentMethod,
          payment_date: todayDate(),
          notes: `Check-Out Payment - ${checkoutPaymentMethod}`,
        });
        newRoomPaid += finalPaymentAmount;
      }
      const refundableKeyDeposit = Math.max(Number(checkoutBooking.keyDepositPaid || 0) - Number(checkoutBooking.keyDepositRefunded || 0), 0);
      if (checkoutRefundKeyDeposit && refundableKeyDeposit > 0) {
        await insertPaymentWithReceipt({
          booking_id: checkoutBooking.id,
          guest_name: checkoutBooking.guest_name,
          room_number: checkoutBooking.room_number || "-",
          amount: refundableKeyDeposit,
          payment_method: checkoutRefundMethod,
          payment_date: todayDate(),
          notes: getKeyDepositMethodLabel("refunded", checkoutRefundMethod),
        });
      }
      const newBalance = Math.max(adjustedTotalAmount - newRoomPaid, 0);
      if (newBalance > 0) {
        const confirmOutstanding = window.confirm(`This guest still has an outstanding balance of ${formatK(newBalance)}. Continue check-out and keep it as accounts receivable?`);
        if (!confirmOutstanding) return;
      }
      const existingNotes = String((checkoutBooking as any).notes || "").trim();
      const checkoutAuditNote = [
        existingNotes,
        additionalCharges > 0 ? `Check-out additional charges: ${formatK(additionalCharges)}` : "",
        checkoutNotes.trim() ? `Check-out note: ${checkoutNotes.trim()}` : "",
      ].filter(Boolean).join(" | ");
      const { error: bookingError } = await supabase
        .from("bookings")
        .update({
          status: "Checked Out",
          total_amount: adjustedTotalAmount,
          deposit: newRoomPaid,
          balance: newBalance,
          notes: checkoutAuditNote || null,
        })
        .eq("id", checkoutBooking.id);
      if (bookingError) throw bookingError;

      await createFinalInvoiceRecord(checkoutBooking, adjustedTotalAmount, newRoomPaid, newBalance);

      if (checkoutBooking.room_id) {
        const { error: roomError } = await supabase
          .from("rooms")
          .update({ status: "Available" })
          .eq("id", checkoutBooking.room_id);
        if (roomError) throw roomError;
      }
      await loadAllData();
      const completedBookingId = checkoutBooking.id;
      setCheckoutBookingId(null);
      setCheckoutFinalPayment("0");
      setCheckoutAdditionalCharges("0");
      setCheckoutNotes("");
      await logAudit("CHECK_OUT", "bookings", checkoutBooking.id, `Guest checked out: ${checkoutBooking.guest_name}, balance ${formatK(newBalance)}`);
      showToast("Guest checked out successfully. Final invoice and receipt are ready to print.", "success");
      setActiveTab("checkouts");
      setTimeout(() => {
        const shouldPrint = window.confirm("Check-out completed. Print final invoice now?");
        if (shouldPrint) printInvoice(completedBookingId);
      }, 300);
    } catch (error: any) {
      showToast(error.message || "Failed to process check-out.", "error");
    } finally {
      setBusy(false);
    }
  }

function printReceipt(bookingId: number) {
    const booking = bookingViews.find((item) => item.id === bookingId);
    if (!booking) {
      showToast("Booking not found.", "error");
      return;
    }
    const bookingPayments = payments
      .filter((payment) => payment.booking_id === booking.id)
      .sort((a, b) => (a.id > b.id ? -1 : 1));
    const guest = guests.find(
      (item) =>
        normalize(item.full_name) === normalize(booking.guest_name) &&
        normalize(item.phone) === normalize(booking.phone)
    ) || guests.find((item) => normalize(item.full_name) === normalize(booking.guest_name));
    const paymentRows = bookingPayments.length
      ? bookingPayments
          .map(
            (payment) => `
            <tr>
              <td style="padding:8px;border:1px solid #dbe3ef;">${payment.payment_date || "-"}</td>
              <td style="padding:8px;border:1px solid #dbe3ef;">${payment.payment_method || "-"}</td>
              <td style="padding:8px;border:1px solid #dbe3ef;text-align:right;">${formatK(payment.amount)}</td>
            </tr>
          `
          )
          .join("")
      : `
        <tr>
          <td colspan="3" style="padding:8px;border:1px solid #dbe3ef;text-align:center;">No payments yet</td>
        </tr>
      `;
    const receiptWindow = window.open("", "_blank", "width=900,height=700");
    if (!receiptWindow) {
      showToast("Pop-up blocked. Allow pop-ups to print receipt.", "error");
      return;
    }
    receiptWindow.document.write(`
      <html>
        <head>
          <title>${RECEIPT_BUSINESS.name} Receipt - ${booking.guest_name}</title>
        </head>
        <body style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
          <div style="max-width:800px;margin:0 auto;background:#fff;border:1px solid #dbe3ef;border-radius:20px;padding:28px;">
            <div style="display:flex;justify-content:space-between;align-items:start;gap:20px;">
              <div style="display:flex;gap:16px;align-items:flex-start;">
                <img src="${RECEIPT_BUSINESS.logo}" alt="${RECEIPT_BUSINESS.name}" style="width:120px;height:auto;object-fit:contain;border-radius:12px;background:#fff;" />
                <div>
                  <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#4f46e5;text-transform:uppercase;">${RECEIPT_BUSINESS.organization}</div>
                  <h1 style="margin:8px 0 4px;font-size:30px;line-height:1.1;">${RECEIPT_BUSINESS.name}</h1>
                  <p style="margin:0;color:#475569;font-weight:700;">Official Receipt</p>
                  <p style="margin:6px 0 0;color:#475569;font-size:13px;">${RECEIPT_BUSINESS.address1}</p>
                  <p style="margin:4px 0 0;color:#475569;font-size:13px;">${RECEIPT_BUSINESS.address2}</p>
                  <p style="margin:4px 0 0;color:#475569;font-size:13px;">Office/Mobile: ${RECEIPT_BUSINESS.phones}</p>
                  <p style="margin:4px 0 0;color:#475569;font-size:13px;">Website: ${RECEIPT_BUSINESS.website}</p>
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:13px;color:#64748b;">Receipt Date</div>
                <div style="font-size:16px;font-weight:700;">${todayDate()}</div>
              </div>
            </div>
            <div style="margin-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:18px;">
              <div style="padding:16px;border:1px solid #dbe3ef;border-radius:14px;background:#f8fafc;">
                <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Guest</div>
                <div style="margin-top:8px;font-size:18px;font-weight:700;">${booking.guest_name}</div>
                <div style="margin-top:6px;color:#475569;">Phone: ${booking.phone || "-"}</div>\n                <div style="margin-top:6px;color:#475569;">Email: ${guest?.email || booking.guestEmail || "-"}</div>
              </div>
              <div style="padding:16px;border:1px solid #dbe3ef;border-radius:14px;background:#f8fafc;">
                <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Stay Details</div>
                <div style="margin-top:8px;color:#475569;">Room: ${booking.room_number || "-"}</div>
                <div style="margin-top:6px;color:#475569;">Check In: ${booking.check_in_date}</div>
                <div style="margin-top:6px;color:#475569;">Check Out: ${booking.check_out_date}</div>
              </div>
            </div>
            <div style="margin-top:24px;">
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:#eef2ff;">
                    <th style="padding:10px;border:1px solid #dbe3ef;text-align:left;">Payment Date</th>
                    <th style="padding:10px;border:1px solid #dbe3ef;text-align:left;">Method</th>
                    <th style="padding:10px;border:1px solid #dbe3ef;text-align:right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${paymentRows}
                </tbody>
              </table>
            </div>
            <div style="margin-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:18px;">
              <div style="padding:16px;border:1px solid #dbe3ef;border-radius:14px;">
                <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Booking Status</div>
                <div style="margin-top:8px;font-size:20px;font-weight:800;">${booking.status}</div>
              </div>
              <div style="padding:16px;border:1px solid #dbe3ef;border-radius:14px;background:#f8fafc;">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                  <span>Total</span>
                  <strong>${formatK(booking.total_amount)}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                  <span>Paid</span>
                  <strong>${formatK(booking.paid)}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;">
                  <span>Balance</span>
                  <strong>${formatK(booking.due)}</strong>
                </div>
                <hr style="margin:14px 0;border:none;border-top:1px solid #dbe3ef;" />
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                  <span>Key Deposit Required</span>
                  <strong>${formatK(booking.keyDepositRequired)}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                  <span>Key Deposit Held</span>
                  <strong>${formatK(booking.keyDepositPaid - booking.keyDepositRefunded)}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span>Key Deposit Status</span>
                  <strong>${booking.keyDepositStatus}</strong>
                </div>
              </div>
            </div>
                      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #dbe3ef;text-align:center;color:#64748b;font-size:13px;">Thank you for staying with ${RECEIPT_BUSINESS.name}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    receiptWindow.document.close();
  }
  function printReport() {
    const paymentMethodRows = Object.entries(reportStats.paymentMethodTotals)
      .map(
        ([method, total]) => `
          <tr>
            <td style="padding:8px;border:1px solid #dbe3ef;">${method}</td>
            <td style="padding:8px;border:1px solid #dbe3ef;text-align:right;">${formatK(total)}</td>
          </tr>
        `
      )
      .join("");
    const outstandingRows = reportStats.outstandingBookings.length
      ? reportStats.outstandingBookings
          .slice(0, 20)
          .map(
            (booking) => `
              <tr>
                <td style="padding:8px;border:1px solid #dbe3ef;">${booking.guest_name}</td>
                <td style="padding:8px;border:1px solid #dbe3ef;">${booking.room_number || "-"}</td>
                <td style="padding:8px;border:1px solid #dbe3ef;">${booking.status}</td>
                <td style="padding:8px;border:1px solid #dbe3ef;text-align:right;">${formatK(booking.due)}</td>
              </tr>
            `
          )
          .join("")
      : `
        <tr>
          <td colspan="4" style="padding:8px;border:1px solid #dbe3ef;text-align:center;">No outstanding balances</td>
        </tr>
      `;
    const reportWindow = window.open("", "_blank", "width=1000,height=800");
    if (!reportWindow) {
      showToast("Pop-up blocked. Allow pop-ups to print report.", "error");
      return;
    }
    reportWindow.document.write(`
      <html>
        <head>
          <title>MTECH Stay Report</title>
        </head>
        <body style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
          <div style="max-width:980px;margin:0 auto;background:#fff;border:1px solid #dbe3ef;border-radius:20px;padding:28px;">
            <div style="display:flex;justify-content:space-between;align-items:start;gap:20px;">
              <div>
                <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#4f46e5;text-transform:uppercase;">MTECH Stay</div>
                <h1 style="margin:8px 0 4px;font-size:32px;">Performance Report</h1>
                <p style="margin:0;color:#475569;">From ${reportStartDate} to ${reportEndDate}</p>
              </div>
              <div style="text-align:right;">
                <div style="font-size:13px;color:#64748b;">Printed</div>
                <div style="font-size:16px;font-weight:700;">${todayDate()}</div>
              </div>
            </div>
            <div style="margin-top:24px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">
              <div style="padding:16px;border:1px solid #dbe3ef;border-radius:14px;background:#f8fafc;">
                <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Revenue</div>
                <div style="margin-top:8px;font-size:24px;font-weight:800;">${formatK(reportStats.revenue)}</div>
              </div>
              <div style="padding:16px;border:1px solid #dbe3ef;border-radius:14px;background:#f8fafc;">
                <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Payments</div>
                <div style="margin-top:8px;font-size:24px;font-weight:800;">${reportStats.totalPayments}</div>
              </div>
              <div style="padding:16px;border:1px solid #dbe3ef;border-radius:14px;background:#f8fafc;">
                <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Outstanding Balance</div>
                <div style="margin-top:8px;font-size:24px;font-weight:800;">${formatK(reportStats.totalOutstanding)}</div>
              </div>
            </div>
            <div style="margin-top:24px;">
              <h3 style="margin:0 0 12px 0;">Payments by Method</h3>
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:#eef2ff;">
                    <th style="padding:10px;border:1px solid #dbe3ef;text-align:left;">Method</th>
                    <th style="padding:10px;border:1px solid #dbe3ef;text-align:right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${paymentMethodRows || `<tr><td colspan="2" style="padding:8px;border:1px solid #dbe3ef;text-align:center;">No payments in selected range</td></tr>`}
                </tbody>
              </table>
            </div>
            <div style="margin-top:24px;">
              <h3 style="margin:0 0 12px 0;">Outstanding Bookings</h3>
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:#eef2ff;">
                    <th style="padding:10px;border:1px solid #dbe3ef;text-align:left;">Guest</th>
                    <th style="padding:10px;border:1px solid #dbe3ef;text-align:left;">Room</th>
                    <th style="padding:10px;border:1px solid #dbe3ef;text-align:left;">Status</th>
                    <th style="padding:10px;border:1px solid #dbe3ef;text-align:right;">Due</th>
                  </tr>
                </thead>
                <tbody>
                  ${outstandingRows}
                </tbody>
              </table>
            </div>
                      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #dbe3ef;text-align:center;color:#64748b;font-size:13px;">Thank you for staying with ${RECEIPT_BUSINESS.name}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    reportWindow.document.close();
  }
  if (booting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 shadow-xl">
          <div className="mx-auto h-14 w-14 animate-pulse rounded-2xl bg-indigo-100" />
          <h2 className="mt-6 text-center text-2xl font-black text-slate-900">Loading MTECH Stay</h2>
          <p className="mt-2 text-center text-sm text-slate-500">Preparing your motel workspace...</p>
        </div>
      </main>
    );
  }
  if (!user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e0e7ff,_#f8fafc_42%,_#e2e8f0)] p-4 text-slate-900 sm:p-8">
        <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[36px] border border-white/70 bg-white/80 shadow-2xl backdrop-blur lg:grid-cols-[1.1fr_0.9fr]">
          <div className="hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-10 text-white lg:block">
            <div className="max-w-xl">
              <div className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-200">
                Premium Motel Operations
              </div>
              <h1 className="mt-6 text-5xl font-black leading-tight">MTECH Stay</h1>
              <p className="mt-5 text-lg text-slate-300">
                Dashboard widgets, strong search, edit/delete, reports, and double-booking protection.
              </p>
              <div className="mt-10 grid gap-4">
                <FeatureCard title="Today Widgets" text="See arrivals, departures, and balances due right on the dashboard." />
                <FeatureCard title="Booking Protection" text="Stop overlapping room bookings before they are saved." />
                <FeatureCard title="Front Desk Control" text="Run the motel faster with clearer live daily operations." />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center p-6 sm:p-10">
            <div className="w-full max-w-md">
              <div className="mb-8 lg:hidden">
                <h1 className="text-4xl font-black tracking-tight text-slate-900">MTECH Stay</h1>
                <p className="mt-2 text-slate-500">Premium motel operations system</p>
              </div>
              <div className="rounded-[32px] border border-slate-200 bg-white p-7 shadow-xl">
                <div className="mb-6 flex rounded-2xl bg-slate-100 p-1">
                  <button
                    onClick={() => setAuthMode("login")}
                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold ${
                      authMode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setAuthMode("signup")}
                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold ${
                      authMode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    Create Account
                  </button>
                </div>
                {message && (
                  <div
                    className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-medium ${
                      messageType === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : messageType === "error"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-sky-200 bg-sky-50 text-sky-700"
                    }`}
                  >
                    {message}
                  </div>
                )}
                <div className="space-y-4">
                  {authMode === "signup" && (
                    <InputField
                      label="Full Name"
                      value={authForm.full_name}
                      onChange={(value) => setAuthForm((prev) => ({ ...prev, full_name: value }))}
                      placeholder="Staff name"
                    />
                  )}
                  <InputField
                    label="Email"
                    value={authForm.email}
                    onChange={(value) => setAuthForm((prev) => ({ ...prev, email: value }))}
                    placeholder="name@example.com"
                    type="email"
                  />
                  <InputField
                    label="Password"
                    value={authForm.password}
                    onChange={(value) => setAuthForm((prev) => ({ ...prev, password: value }))}
                    placeholder="Enter password"
                    type="password"
                  />
                  <button
                    onClick={handleAuth}
                    className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
                  >
                    {busy ? "Please wait..." : authMode === "login" ? "Login to System" : "Create Staff Account"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }
  if (!loading && !staffLoading && staffRole === "No Access") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-900">
        <div className="w-full max-w-lg rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-50 text-3xl">🔒</div>
          <h2 className="mt-6 text-2xl font-black text-slate-900">No Staff Access</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Your login is working, but this email has not been added to <b>motel_staff_profiles</b> or the account is inactive.
            A Manager must add this staff email and assign a role before the system opens.
          </p>
          <p className="mt-4 break-all rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{user?.email}</p>
          <button
            onClick={handleSignOut}
            className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            Sign Out
          </button>
        </div>
      </main>
    );
  }
  if (loading) {
    return (
      <AppShell
        title="Motel Management System"
        subtitle="Connected to live Supabase data"
        activeTab={activeTab}
        setActiveTab={openTab}
        onSignOut={handleSignOut}
        userEmail={user?.email || ""}
        staffRole={staffRole}
        staffName={staffProfile?.full_name || ""}
      >
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <p className="text-lg font-semibold text-slate-800">Loading motel system...</p>
          </div>
        </div>
      </AppShell>
    );
  }
  return (
    <AppShell
      title="Motel Management System"
      subtitle="Dashboard widgets, search filters, edit/delete, reports, and booking protection"
      activeTab={activeTab}
      setActiveTab={openTab}
      onSignOut={handleSignOut}
      userEmail={user?.email || ""}
      staffRole={staffRole}
      staffName={staffProfile?.full_name || ""}
    >
      {message && (
        <div
          className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
            messageType === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : messageType === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-sky-200 bg-sky-50 text-sky-700"
          }`}
        >
          {message}
        </div>
      )}
      {busy && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
          Saving changes...
        </div>
      )}
      {!canAccessTab(staffRole, activeTab) && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          <h3 className="text-lg font-black">Access denied</h3>
          <p className="mt-2 text-sm">Your role ({staffRole}) cannot access this section.</p>
        </div>
      )}
      {canAccessTab(staffRole, "dashboard") && activeTab === "dashboard" && (
        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <PremiumStatCard label="Total Rooms" value={dashboardStats.totalRooms} subtext="Live inventory" />
            <PremiumStatCard label="Available" value={dashboardStats.availableRooms} subtext="Ready for guests" />
            <PremiumStatCard label="Occupied" value={dashboardStats.occupiedRooms} subtext="Currently in use" />
            <PremiumStatCard label="Reserved" value={dashboardStats.reservedRooms} subtext="Upcoming stays" />
            <PremiumStatCard label="Guests" value={dashboardStats.totalGuests} subtext="Saved profiles" />
            <PremiumStatCard label="Bookings" value={dashboardStats.totalBookings} subtext="Stay records" />
            <PremiumStatCard label="Payments" value={dashboardStats.totalPayments} subtext="Transactions saved" />
            {staffRole !== "Maintenance" && <PremiumStatCard label="Invoices" value={invoiceRegister.length} subtext="Billing records" />}
            <PremiumStatCard label="Cleaning" value={dashboardStats.cleaningRooms} subtext="Needs turnaround" />
            <PremiumStatCard label="Maintenance" value={dashboardStats.maintenanceRooms} subtext="Unavailable units" />
            {staffRole === "Manager" && (
              <>
                <PremiumMoneyCard label="Revenue" value={dashboardStats.totalRevenue} subtext="Recorded cashflow" />
                <PremiumMoneyCard label="Expenses" value={dashboardStats.totalExpenses} subtext="Operating costs" />
                <PremiumMoneyCard label="Net Profit" value={dashboardStats.netProfit} subtext="Revenue minus expenses" />
              </>
            )}
            <PremiumMoneyCard label="Outstanding" value={dashboardStats.totalOutstanding} subtext="Unpaid balances" />
            {staffRole === "Manager" && <PremiumStatCard label="Audit Logs" value={dashboardStats.totalAuditLogs} subtext="Action history" />}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <DailyWidget
              title="Arrivals Today"
              value={arrivalsToday.length}
              subtitle="Guests expected today"
            />
            <DailyWidget
              title="Departures Today"
              value={departuresToday.length}
              subtitle="Guests checking out today"
            />
            <DailyMoneyWidget
              title="Balances Due"
              value={dueToday.reduce((sum, item) => sum + Number(item.due || 0), 0)}
              subtitle="Current unpaid balances"
            />
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-black tracking-tight">Today Arrivals</h3>
                <p className="text-sm text-slate-500">Guests expected to check in today</p>
              </div>
              <div className="space-y-3">
                {arrivalsToday.length === 0 ? (
                  <EmptyState title="No arrivals today" text="No guest is scheduled to arrive today." />
                ) : (
                  arrivalsToday.map((booking) => (
                    <CompactBookingCard key={booking.id} booking={booking} />
                  ))
                )}
              </div>
            </section>
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-black tracking-tight">Today Departures</h3>
                <p className="text-sm text-slate-500">Guests expected to check out today</p>
              </div>
              <div className="space-y-3">
                {departuresToday.length === 0 ? (
                  <EmptyState title="No departures today" text="No guest is scheduled to depart today." />
                ) : (
                  departuresToday.map((booking) => (
                    <CompactBookingCard key={booking.id} booking={booking} />
                  ))
                )}
              </div>
            </section>
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-black tracking-tight">Balances Due</h3>
                <p className="text-sm text-slate-500">Bookings with unpaid balances</p>
              </div>
              <div className="space-y-3">
                {dueToday.length === 0 ? (
                  <EmptyState title="No balances due" text="No current booking has an unpaid balance." />
                ) : (
                  dueToday.slice(0, 8).map((booking) => (
                    <div
                      key={booking.id}
                      className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black">{booking.guest_name}</p>
                          <p className="text-sm text-slate-500">
                            Room {booking.room_number || "-"}
                          </p>
                        </div>
                        <p className="text-sm font-black text-rose-700">{formatK(booking.due)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black tracking-tight">Rooms Overview</h3>
                  <p className="text-sm text-slate-500">Current room availability and rates</p>
                </div>
                <button
                  onClick={() => loadAllData()}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black">{room.room_number}</p>
                        <p className="text-sm text-slate-500">{room.room_type}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${roomStatusStyles[room.status]}`}>
                        {room.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium text-slate-700">
                      {formatK(room.price)} / {room.billing_type}
                    </p>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-black tracking-tight">Recent Bookings</h3>
                <p className="text-sm text-slate-500">Latest activity from the front desk</p>
              </div>
              <div className="space-y-3">
                {bookingViews.length === 0 ? (
                  <EmptyState title="No bookings yet" text="Create your first booking to see activity here." />
                ) : (
                  bookingViews.slice(0, 8).map((booking) => (
                    <div
                      key={booking.id}
                      className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{booking.guest_name}</p>
                          <p className="text-sm text-slate-500">
                            {booking.room_number || "-"} • {booking.room?.room_type || "Room"}
                          </p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${bookingStatusStyles[booking.status]}`}>
                          {booking.status}
                        </span>
                      </div>
                      <div className="mt-3 text-sm text-slate-700">
                        <p>Total: {formatK(booking.total_amount)}</p>
                        <p>Paid: {formatK(booking.paid)}</p>
                        <p>Due: {formatK(booking.due)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      )}
      {canAccessTab(staffRole, "rooms") && activeTab === "rooms" && (
        <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black tracking-tight">{editingRoomId ? "Edit Room" : "Add Room"}</h3>
                <p className="text-sm text-slate-500">
                  {editingRoomId ? "Update room details and save changes" : "Create more room inventory when needed"}
                </p>
              </div>
              {editingRoomId && (
                <button
                  onClick={resetRoomForm}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            <div className="space-y-4">
              <InputField
                label="Room Number"
                value={roomForm.room_number}
                onChange={(value) => setRoomForm((prev) => ({ ...prev, room_number: value }))}
                placeholder="Example: A7"
              />
              <SelectField
                label="Room Type"
                value={roomForm.room_type}
                onChange={(value) => setRoomForm((prev) => ({ ...prev, room_type: value }))}
                options={["Apartment", "Single Room", "Deluxe Room", "Commercial Unit"]}
              />
              <InputField
                label="Price"
                type="number"
                value={String(roomForm.price)}
                onChange={(value) => setRoomForm((prev) => ({ ...prev, price: Number(value) || 0 }))}
              />
              <SelectField
                label="Billing Type"
                value={roomForm.billing_type}
                onChange={(value) => setRoomForm((prev) => ({ ...prev, billing_type: value as BillingType }))}
                options={["Night", "Month"]}
              />
              <SelectField
                label="Status"
                value={roomForm.status}
                onChange={(value) => setRoomForm((prev) => ({ ...prev, status: value as RoomStatus }))}
                options={["Available", "Occupied", "Reserved", "Cleaning", "Maintenance"]}
              />
              <TextAreaField
                label="Notes"
                value={roomForm.notes}
                onChange={(value) => setRoomForm((prev) => ({ ...prev, notes: value }))}
                placeholder="Optional notes"
              />
              <button
                onClick={saveRoom}
                className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
              >
                {editingRoomId ? "Update Room" : "Save Room"}
              </button>
            </div>
          </section>
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black tracking-tight">Room List</h3>
                  <p className="text-sm text-slate-500">Search and filter live room status and pricing</p>
                </div>
                <button
                  onClick={() => loadAllData()}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <InputField
                  label="Search Rooms"
                  value={roomSearch}
                  onChange={setRoomSearch}
                  placeholder="Room number, type, note"
                />
                <SelectField
                  label="Status Filter"
                  value={roomStatusFilter}
                  onChange={setRoomStatusFilter}
                  options={["All", "Available", "Occupied", "Reserved", "Cleaning", "Maintenance"]}
                />
                <div className="flex items-end">
                  <button
                    onClick={clearRoomFilters}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
            <div className="mb-4 text-sm text-slate-500">
              Showing {filteredRooms.length} of {rooms.length} room(s)
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredRooms.map((room) => (
                <div
                  key={room.id}
                  className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black">{room.room_number}</p>
                      <p className="text-sm text-slate-500">{room.room_type}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${roomStatusStyles[room.status]}`}>
                      {room.status}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-slate-700">
                    <p>Rate: {formatK(room.price)} / {room.billing_type}</p>
                    <p>Notes: {room.notes || "No notes"}</p>
                  </div>
                  <div className="mt-4">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Quick Status Change
                    </label>
                    <select
                      value={room.status}
                      onChange={(e) => updateRoomStatus(room.id, e.target.value as RoomStatus)}
                      className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    >
                      {["Available", "Occupied", "Reserved", "Cleaning", "Maintenance"].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => startEditRoom(room)}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteRoom(room.id)}
                      className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {filteredRooms.length === 0 && (
              <div className="mt-4">
                <EmptyState title="No rooms found" text="Try a different room search or status filter." />
              </div>
            )}
          </section>
        </section>
      )}
      {canAccessTab(staffRole, "bookings") && activeTab === "bookings" && (
        <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <section className="grid gap-6 xl:grid-cols-[430px_1fr]">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black tracking-tight">{editingBookingId ? "Edit Booking" : "Create Booking"}</h3>
                  <p className="text-sm text-slate-500">
                    {editingBookingId ? "Update stay details and save changes" : "Register a new stay and optional deposit"}
                  </p>
                </div>
                {editingBookingId && (
                  <button
                    onClick={resetBookingForm}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
              <div className="space-y-4">
                <InputField
                  label="Guest Name"
                  value={bookingForm.guest_name}
                  onChange={(value) => setBookingForm((prev) => ({ ...prev, guest_name: value }))}
                  placeholder="Enter guest name"
                />
                <InputField
                  label="Phone"
                  value={bookingForm.phone}
                  onChange={(value) => setBookingForm((prev) => ({ ...prev, phone: value }))}
                  placeholder="Phone number"
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Select Room</label>
                  <select
                    value={bookingForm.room_id}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, room_id: Number(e.target.value) }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-400"
                  >
                    <option value={0}>Select room</option>
                    {availableRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.room_number} - {room.room_type} - {formatK(room.price)}/{room.billing_type}
                      </option>
                    ))}
                  </select>
                </div>
                <InputField
                  label="Check-In Date"
                  type="date"
                  value={bookingForm.check_in_date}
                  onChange={(value) => setBookingForm((prev) => ({ ...prev, check_in_date: value }))}
                />
                <InputField
                  label="Check-Out Date"
                  type="date"
                  value={bookingForm.check_out_date}
                  onChange={(value) => setBookingForm((prev) => ({ ...prev, check_out_date: value }))}
                />
                {!editingBookingId && (
                  <>
                    <SelectField
                      label="Payment Type"
                      value={bookingForm.payment_arrangement}
                      onChange={(value) => setBookingForm((prev) => ({ ...prev, payment_arrangement: value }))}
                      options={["Reserve Only", "Pay Now", "Part Payment", "Government / Corporate"]}
                    />
                    <div className={`rounded-2xl border p-3 text-sm ${bookingCreatesImmediatePayment ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                      {bookingCreatesImmediatePayment
                        ? "This booking will record a payment immediately and show it in the Payments tab."
                        : "This will reserve the room only. No payment will be recorded until you add one later."}
                    </div>
                    <InputField
                      label={bookingCreatesImmediatePayment ? "Amount Paid Now" : "Amount Paid Now (ignored for Reserve Only)"}
                      type="number"
                      value={String(bookingForm.deposit)}
                      onChange={(value) => setBookingForm((prev) => ({ ...prev, deposit: Number(value) || 0 }))}
                    />
                    <SelectField
                      label="Payment Method"
                      value={bookingForm.deposit_method}
                      onChange={(value) => setBookingForm((prev) => ({ ...prev, deposit_method: value }))}
                      options={["Cash", "Card", "Bank Transfer", "Mobile Transfer"]}
                    />
                    {bookingForm.payment_arrangement === "Government / Corporate" && (
                      <>
                        <InputField
                          label="Organisation Name"
                          value={bookingForm.organization_name}
                          onChange={(value) => setBookingForm((prev) => ({ ...prev, organization_name: value }))}
                          placeholder="Example: Government Department"
                        />
                        <InputField
                          label="Reference / LPO"
                          value={bookingForm.reference_no}
                          onChange={(value) => setBookingForm((prev) => ({ ...prev, reference_no: value }))}
                          placeholder="Optional reference number"
                        />
                      </>
                    )}
                  </>
                )}
                <SelectField
                  label="Booking Status"
                  value={bookingForm.status}
                  onChange={(value) => setBookingForm((prev) => ({ ...prev, status: value as BookingStatus }))}
                  options={["Reserved", "Checked In", "Checked Out", "Cancelled"]}
                />
                <TextAreaField
                  label="Notes"
                  value={bookingForm.notes}
                  onChange={(value) => setBookingForm((prev) => ({ ...prev, notes: value }))}
                  placeholder="Optional notes"
                />
                {currentConflict && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    Room conflict: {selectedRoom?.room_number} already overlaps with {currentConflict.guest_name} from {currentConflict.check_in_date} to {currentConflict.check_out_date}.
                  </div>
                )}
                <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-indigo-50 to-white p-4">
                  <h4 className="mb-3 font-black text-slate-900">Booking Summary</h4>
                  <div className="space-y-2 text-sm text-slate-700">
                    <p>Room: {selectedRoom ? `${selectedRoom.room_number} (${selectedRoom.room_type})` : "-"}</p>
                    <p>Billing: {selectedRoom?.billing_type || "-"}</p>
                    <p>Rate: {formatK(bookingRate)}</p>
                    <p>
                      Duration: {bookingDuration}{" "}
                      {selectedRoom?.billing_type === "Month" ? "month(s)" : "night(s)"}
                    </p>
                    <p>Total: {formatK(bookingTotal)}</p>
                    <p>Payment Type: {bookingForm.payment_arrangement}</p>
                    {!editingBookingId && <p>Payment Recorded Now: {formatK(bookingAmountPaidNow)}</p>}
                    <p>Suggested Room Charge: {selectedRoom ? `${formatK(selectedRoom.price)} per ${selectedRoom.billing_type}` : "-"}</p>
                    <p>Key Deposit: {formatK(bookingKeyDeposit)}</p>
                    <p className="font-bold">
                      Balance: {formatK(editingBookingId ? bookingTotal : bookingBalance)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={saveBooking}
                  className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
                >
                  {editingBookingId ? "Update Booking" : "Save Booking"}
                </button>
              </div>
            </section>
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black tracking-tight">Bookings List</h3>
                    <p className="text-sm text-slate-500">Manage stay status, balances, receipts, and check-outs</p>
                  </div>
                  <button
                    onClick={() => loadAllData()}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    Refresh
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <InputField
                    label="Search Bookings"
                    value={bookingSearch}
                    onChange={setBookingSearch}
                    placeholder="Guest, phone, room"
                  />
                  <SelectField
                    label="Status Filter"
                    value={bookingStatusFilter}
                    onChange={setBookingStatusFilter}
                    options={["All", "Reserved", "Checked In", "Checked Out", "Cancelled"]}
                  />
                  <InputField
                    label="Date Filter"
                    type="date"
                    value={bookingDateFilter}
                    onChange={setBookingDateFilter}
                  />
                  <div className="flex items-end">
                    <button
                      onClick={clearBookingFilters}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              </div>
              <div className="mb-4 text-sm text-slate-500">
                Showing {filteredBookings.length} of {bookingViews.length} booking(s)
              </div>
              <div className="space-y-4">
                {filteredBookings.length === 0 ? (
                  <EmptyState title="No bookings found" text="Try a different booking search, status, or date." />
                ) : (
                  filteredBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className={`rounded-[28px] border p-4 ${selectedBookingId === booking.id ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-gradient-to-br from-white to-slate-50"}`}
                    >
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <h4 className="text-lg font-black">{booking.guest_name}</h4>
                          <p className="text-sm text-slate-500">
                            {booking.room_number || "-"} • {booking.room?.room_type || "Room"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${bookingStatusStyles[booking.status]}`}>
                            {booking.status}
                          </span>
                          <button
                            onClick={() => printReceipt(booking.id)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Print Receipt
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
                        <p>Phone: {booking.phone || "-"}</p>
                        <p>Check-In: {booking.check_in_date}</p>
                        <p>Check-Out: {booking.check_out_date}</p>
                        <p>Total: {formatK(booking.total_amount)}</p>
                        <p>Paid: {formatK(booking.paid)}</p>
                        <p>Due: {formatK(booking.due)}</p>
                        <p>Room Rate: {formatK(booking.room?.price || 0)}</p>
                        <p>Billing: {booking.room?.billing_type || "-"}</p>
                      </div>
                      <div className="mt-4">
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Quick Booking Status
                        </label>
                        <select
                          value={booking.status}
                          onChange={(e) =>
                            changeBookingStatus(
                              booking.id,
                              booking.room_id,
                              e.target.value as BookingStatus
                            )
                          }
                          className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                        >
                          {["Reserved", "Checked In", "Checked Out", "Cancelled"].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="mt-4 grid grid-cols-4 gap-2">
                        <button
                          onClick={() => setSelectedBookingId(booking.id)}
                          className="rounded-2xl border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => quickPayBooking(booking)}
                          disabled={Number(booking.due || 0) <= 0}
                          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          💳 Pay
                        </button>
                        <button
                          onClick={() => startEditBooking(booking)}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteBooking(booking.id, booking.room_id)}
                          className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </section>
          <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black tracking-tight">Booking Details</h3>
                <p className="text-sm text-slate-500">Open a booking to view full details</p>
              </div>
              {selectedBooking && (
                <button
                  onClick={() => setSelectedBookingId(null)}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Close
                </button>
              )}
            </div>
            {!selectedBooking ? (
              <EmptyState title="No booking selected" text="Click “View Details” on a booking card to open full booking details here." />
            ) : (
              <div className="space-y-5">
                <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-xl font-black">{selectedBooking.guest_name}</h4>
                      <p className="text-sm text-slate-500">Booking Ref #{selectedBooking.id}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${bookingStatusStyles[selectedBooking.status]}`}>
                      {selectedBooking.status}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                    <p><strong>Phone:</strong> {selectedBooking.phone || "-"}</p>
                    <p><strong>Room:</strong> {selectedBooking.room_number || "-"}</p>
                    <p><strong>Room Type:</strong> {selectedBooking.room?.room_type || "-"}</p>
                    <p><strong>Billing:</strong> {selectedBooking.room?.billing_type || "-"}</p>
                    <p><strong>Check-In:</strong> {selectedBooking.check_in_date}</p>
                    <p><strong>Check-Out:</strong> {selectedBooking.check_out_date}</p>
                    <p><strong>Total:</strong> {formatK(selectedBooking.total_amount)}</p>
                    <p><strong>Paid:</strong> {formatK(selectedBooking.paid)}</p>
                    <p><strong>Balance:</strong> {formatK(selectedBooking.due)}</p>
                    <p><strong>Guest Email:</strong> {selectedBooking.guestEmail || linkedGuest?.email || "-"}</p>
                    <p><strong>Key Deposit Required:</strong> {formatK(selectedBooking.keyDepositRequired)}</p>
                    <p><strong>Key Deposit Held:</strong> {formatK(selectedBooking.keyDepositPaid - selectedBooking.keyDepositRefunded)}</p>
                    <p><strong>Created:</strong> {String(selectedBooking.created_at || "-").slice(0, 10)}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <button
                      onClick={() => printReceipt(selectedBooking.id)}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      Print Receipt
                    </button>
                    <button
                      onClick={() => openEmailReceipt(selectedBooking.id)}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      Email Receipt
                    </button>
                    <button
                      onClick={() => {
                        setPaymentForm((prev) => ({
                          ...prev,
                          booking_id: selectedBooking.id,
                          amount: Number(selectedBooking.due || 0),
                          payment_date: todayDate(),
                        }));
                        setActiveTab("payments");
                      }}
                      className="rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      Add Payment
                    </button>
                    <button
                      onClick={() => startEditBooking(selectedBooking)}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      Edit Booking
                    </button>
                  </div>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-lg font-black">Invoice Summary</h4>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {getInvoiceStatus(selectedBooking)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm text-slate-700">
                    <p><strong>Invoice Number:</strong> {formatInvoiceNumber(selectedBooking.id)}</p>
                    <p><strong>Issue Date:</strong> {selectedBooking.created_at ? String(selectedBooking.created_at).slice(0, 10) : todayDate()}</p>
                    <p><strong>Total Charges:</strong> {formatK(selectedBooking.total_amount)}</p>
                    <p><strong>Payments Received:</strong> {formatK(selectedBooking.roomPaid)}</p>
                    <p><strong>Outstanding Balance:</strong> {formatK(selectedBooking.due)}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => printInvoice(selectedBooking.id)}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      Print Invoice
                    </button>
                    <button
                      onClick={() => openEmailInvoice(selectedBooking.id)}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      Email Invoice
                    </button>
                  </div>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-lg font-black">Guest Details</h4>
                  {linkedGuest ? (
                    <div className="mt-3 grid gap-3 text-sm text-slate-700">
                      <p><strong>Full Name:</strong> {linkedGuest.full_name}</p>
                      <p><strong>Phone:</strong> {linkedGuest.phone || "-"}</p>
                      <p><strong>Email:</strong> {linkedGuest.email || "-"}</p>
                      <p><strong>ID Number:</strong> {linkedGuest.id_number || "-"}</p>
                      <p><strong>Address:</strong> {linkedGuest.address || "-"}</p>
                      <p><strong>Notes:</strong> {linkedGuest.notes || "-"}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No linked guest record found for this booking.</p>
                  )}
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-lg font-black">Room Details</h4>
                  {selectedBooking.room ? (
                    <div className="mt-3 grid gap-3 text-sm text-slate-700">
                      <p><strong>Room Number:</strong> {selectedBooking.room.room_number}</p>
                      <p><strong>Room Type:</strong> {selectedBooking.room.room_type}</p>
                      <p><strong>Rate:</strong> {formatK(selectedBooking.room.price)}</p>
                      <p><strong>Billing Type:</strong> {selectedBooking.room.billing_type}</p>
                      <p><strong>Status:</strong> {selectedBooking.room.status}</p>
                      <p><strong>Notes:</strong> {selectedBooking.room.notes || "-"}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No linked room details found.</p>
                  )}
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-lg font-black">Key Deposit</h4>
                  <div className="mt-3 grid gap-3 text-sm text-slate-700">
                    <p><strong>Required:</strong> {formatK(selectedBooking.keyDepositRequired)}</p>
                    <p><strong>Received:</strong> {formatK(selectedBooking.keyDepositPaid)}</p>
                    <p><strong>Refunded:</strong> {formatK(selectedBooking.keyDepositRefunded)}</p>
                    <p><strong>Held Balance:</strong> {formatK(selectedBooking.keyDepositPaid - selectedBooking.keyDepositRefunded)}</p>
                    <p><strong>Status:</strong> {selectedBooking.keyDepositStatus}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => recordKeyDeposit(selectedBooking.id, selectedBooking.keyDepositOutstanding || selectedBooking.keyDepositRequired, "received")}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      Record Key Deposit
                    </button>
                    <button
                      onClick={() => recordKeyDeposit(selectedBooking.id, selectedBooking.keyDepositPaid - selectedBooking.keyDepositRefunded, "refunded")}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      Refund Key Deposit
                    </button>
                  </div>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-lg font-black">Payment History</h4>
                    <button
                      onClick={() => {
                        setPaymentForm((prev) => ({
                          ...prev,
                          booking_id: selectedBooking.id,
                          amount: Number(selectedBooking.due || 0),
                          payment_date: todayDate(),
                        }));
                        setActiveTab("payments");
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                    >
                      Add Payment
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {selectedBookingPayments.length === 0 ? (
                      <p className="text-sm text-slate-500">No payment recorded yet for this booking.</p>
                    ) : (
                      selectedBookingPayments.map((payment) => (
                        <div key={payment.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-800">{payment.payment_method || "Unknown method"}</p>
                              <p className="text-sm text-slate-500">{payment.payment_date || "-"}</p>
                              <p className="text-xs text-slate-400">Receipt {formatReceiptNumber(payment.id)} • Invoice {formatInvoiceNumber(selectedBooking.id)}</p>
                            </div>
                            <p className="font-black text-slate-900">{formatK(payment.amount)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </section>
      )}
      {canAccessTab(staffRole, "guests") && activeTab === "guests" && (
        <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black tracking-tight">{editingGuestId ? "Edit Guest" : "Add Guest"}</h3>
                <p className="text-sm text-slate-500">
                  {editingGuestId ? "Update guest details and save changes" : "Store guest details for faster repeat stays"}
                </p>
              </div>
              {editingGuestId && (
                <button
                  onClick={resetGuestForm}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            <div className="space-y-4">
              <InputField
                label="Full Name"
                value={guestForm.full_name}
                onChange={(value) => setGuestForm((prev) => ({ ...prev, full_name: value }))}
                placeholder="Guest name"
              />
              <InputField
                label="Phone"
                value={guestForm.phone}
                onChange={(value) => setGuestForm((prev) => ({ ...prev, phone: value }))}
                placeholder="Phone number"
              />
              <InputField
                label="Email"
                value={guestForm.email}
                onChange={(value) => setGuestForm((prev) => ({ ...prev, email: value }))}
                placeholder="Optional"
              />
              <InputField
                label="ID Number"
                value={guestForm.id_number}
                onChange={(value) => setGuestForm((prev) => ({ ...prev, id_number: value }))}
                placeholder="Optional"
              />
              <InputField
                label="Address"
                value={guestForm.address}
                onChange={(value) => setGuestForm((prev) => ({ ...prev, address: value }))}
                placeholder="Optional"
              />
              <TextAreaField
                label="Notes"
                value={guestForm.notes}
                onChange={(value) => setGuestForm((prev) => ({ ...prev, notes: value }))}
                placeholder="Optional notes"
              />
              <button
                onClick={saveGuest}
                className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
              >
                {editingGuestId ? "Update Guest" : "Save Guest"}
              </button>
            </div>
          </section>
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black tracking-tight">Guest List</h3>
                  <p className="text-sm text-slate-500">Search guests by name, phone, email, ID, or address</p>
                </div>
                <button
                  onClick={() => loadAllData()}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                <InputField
                  label="Search Guests"
                  value={guestSearch}
                  onChange={setGuestSearch}
                  placeholder="Name, phone, email, ID"
                />
                <div className="flex items-end">
                  <button
                    onClick={clearGuestFilters}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                  >
                    Clear Search
                  </button>
                </div>
              </div>
            </div>
            <div className="mb-4 text-sm text-slate-500">
              Showing {filteredGuests.length} of {guests.length} guest(s)
            </div>
            <div className="space-y-4">
              {filteredGuests.length === 0 ? (
                <EmptyState title="No guests found" text="Try a different guest search term." />
              ) : (
                filteredGuests.map((guest) => (
                  <div
                    key={guest.id}
                    className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4"
                  >
                    <h4 className="text-lg font-black">{guest.full_name}</h4>
                    <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                      <p>Phone: {guest.phone || "-"}</p>
                      <p>Email: {guest.email || "-"}</p>
                      <p>ID: {guest.id_number || "-"}</p>
                      <p>Address: {guest.address || "-"}</p>
                    </div>
                    {guest.notes && <p className="mt-3 text-sm text-slate-600">Notes: {guest.notes}</p>}
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => startEditGuest(guest)}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteGuest(guest.id)}
                        className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>
      )}
      {canAccessTab(staffRole, "checkouts") && activeTab === "checkouts" && (
        <section className="space-y-6">
          <section className="grid gap-6 xl:grid-cols-[1fr_430px]">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black tracking-tight">Check-Out Queue</h3>
                  <p className="text-sm text-slate-500">Process checked-in guests leaving today or later</p>
                </div>
                <button onClick={() => loadAllData()} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                  Refresh
                </button>
              </div>
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <PremiumStatCard label="Checked In" value={checkedInBookings.length} subtext="Active stays" />
                <PremiumStatCard label="Due Today" value={checkedInBookings.filter((b) => b.check_out_date === todayDate()).length} subtext="Expected departures" />
                <PremiumMoneyCard label="Outstanding" value={checkedInBookings.reduce((sum, b) => sum + Number(b.due || 0), 0)} subtext="Still to collect" />
              </div>
              <div className="space-y-4">
                {checkedInBookings.length === 0 ? (
                  <EmptyState title="No checked-in guests" text="Guests marked as Checked In will appear here for check-out processing." />
                ) : (
                  checkedInBookings.map((booking) => (
                    <div key={booking.id} className={`rounded-[24px] border p-4 ${checkoutBookingId === booking.id ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-gradient-to-br from-white to-slate-50"}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h4 className="text-lg font-black">{booking.guest_name}</h4>
                          <p className="text-sm text-slate-500">Room {booking.room_number || "-"} • Due out {booking.check_out_date}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${bookingStatusStyles[booking.status]}`}>
                          {booking.status}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
                        <p>Total: {formatK(booking.total_amount)}</p>
                        <p>Room Paid: {formatK(booking.roomPaid)}</p>
                        <p>Balance Due: {formatK(booking.due)}</p>
                        <p>Key Deposit Held: {formatK(Math.max(booking.keyDepositPaid - booking.keyDepositRefunded, 0))}</p>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <button onClick={() => setCheckoutBookingId(booking.id)} className="rounded-2xl border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
                          Process Check-Out
                        </button>
                        <button onClick={() => printReceipt(booking.id)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                          Print Receipt
                        </button>
                        <button onClick={() => emailReceipt(booking.id)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                          Email Receipt
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-black tracking-tight">Check-Out Summary</h3>
                <p className="text-sm text-slate-500">Finalize payment, deposit, and room status</p>
              </div>
              {!checkoutBooking ? (
                <EmptyState title="No guest selected" text="Choose a checked-in guest to complete check-out." />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-black">{checkoutBooking.guest_name}</h4>
                        <p className="text-sm text-slate-500">Room {checkoutBooking.room_number || "-"} • {checkoutBooking.room?.room_type || "Room"}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${bookingStatusStyles[checkoutBooking.status]}`}>
                        {checkoutBooking.status}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                      <p>Total Stay: {formatK(checkoutBooking.total_amount)}</p>
                      <p>Room Paid: {formatK(checkoutBooking.roomPaid)}</p>
                      <p>Balance Due: {formatK(checkoutBooking.due)}</p>
                      <p>Key Deposit Required: {formatK(checkoutBooking.keyDepositRequired)}</p>
                      <p>Key Deposit Held: {formatK(Math.max(checkoutBooking.keyDepositPaid - checkoutBooking.keyDepositRefunded, 0))}</p>
                      <p>Check-Out Date: {checkoutBooking.check_out_date}</p>
                    </div>
                  </div>
                  <InputField label="Additional Charges at Check-Out" type="number" value={checkoutAdditionalCharges} onChange={setCheckoutAdditionalCharges} />
                  <InputField label="Final Payment at Check-Out" type="number" value={checkoutFinalPayment} onChange={setCheckoutFinalPayment} />
                  <SelectField label="Final Payment Method" value={checkoutPaymentMethod} onChange={setCheckoutPaymentMethod} options={["Cash", "Card", "Bank Transfer", "Mobile Transfer"]} />
                  <TextAreaField label="Check-Out Notes" value={checkoutNotes} onChange={setCheckoutNotes} placeholder="Optional notes: damage, late check-out fee, minibar, manual adjustment, etc." />
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                      <input type="checkbox" checked={checkoutRefundKeyDeposit} onChange={(e) => setCheckoutRefundKeyDeposit(e.target.checked)} />
                      Refund key deposit on check-out
                    </label>
                    {checkoutRefundKeyDeposit && (
                      <div className="mt-4">
                        <SelectField label="Refund Method" value={checkoutRefundMethod} onChange={setCheckoutRefundMethod} options={["Cash", "Card", "Bank Transfer", "Mobile Transfer"]} />
                      </div>
                    )}
                  </div>
                  <div className="rounded-[24px] border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-800">
                    <p><strong>After completion:</strong></p>
                    <p>• booking will move to Checked Out</p>
                    <p>• room will move to Available</p>
                    <p>• additional charges will be added if entered</p>
                    <p>• final payment will be recorded if entered</p>
                    <p>• key deposit refund will be recorded if selected</p>
                    <p>• checkout record will appear in Recent Check-Outs</p>
                  </div>
                  <button onClick={processCheckout} className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800">
                    Complete Check-Out
                  </button>
                </div>
              )}
            </aside>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black tracking-tight">Recent Check-Outs</h3>
                <p className="text-sm text-slate-500">Summary and record of completed check-out transactions</p>
              </div>
              <div className="text-right text-sm text-slate-500">
                <p>Total Check-Outs: {checkoutReportStats.totalCheckouts}</p>
                <p>Collected at Check-Out: {formatK(checkoutReportStats.checkoutRevenue)}</p>
                <p>Deposits Refunded: {formatK(checkoutReportStats.refundedDeposits)}</p>
              </div>
            </div>

            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              <PremiumStatCard label="Recent Check-Outs" value={checkoutReportStats.totalCheckouts} subtext="Completed stays" />
              <PremiumMoneyCard label="Check-Out Revenue" value={checkoutReportStats.checkoutRevenue} subtext="Collected at checkout" />
              <PremiumMoneyCard label="Deposit Refunds" value={checkoutReportStats.refundedDeposits} subtext="Returned to guests" />
            </div>

            <div className="space-y-4">
              {recentCheckoutSummary.length === 0 ? (
                <EmptyState title="No check-out records yet" text="Completed check-outs will appear here with payment and refund summary." />
              ) : (
                recentCheckoutSummary.slice(0, 12).map((booking) => (
                  <div key={booking.id} className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <h4 className="text-lg font-black">{booking.guest_name}</h4>
                        <p className="text-sm text-slate-500">
                          Room {booking.room_number || "-"} • Checked out {booking.check_out_date}
                        </p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${bookingStatusStyles[booking.status]}`}>
                        {booking.status}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
                      <p>Total Stay: {formatK(booking.total_amount)}</p>
                      <p>Total Room Paid: {formatK(booking.finalRoomPaid)}</p>
                      <p>Final Payment: {formatK(booking.finalCheckoutPayment)}</p>
                      <p>Balance After Check-Out: {formatK(booking.finalBalance)}</p>
                      <p>Key Deposit Required: {formatK(booking.keyDepositRequired)}</p>
                      <p>Key Deposit Paid: {formatK(booking.keyDepositPaid)}</p>
                      <p>Key Deposit Refunded: {formatK(booking.keyDepositRefundedAtCheckout)}</p>
                      <p>Deposit Status: {booking.keyDepositStatus}</p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <button onClick={() => printReceipt(booking.id)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                        Print Summary
                      </button>
                      <button onClick={() => emailReceipt(booking.id)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                        Email Summary
                      </button>
                      <button onClick={() => { setSelectedBookingId(booking.id); setActiveTab("bookings"); }} className="rounded-2xl border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
                        Open Booking
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>

      )}

      {canAccessTab(staffRole, "payments") && activeTab === "payments" && (
        <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black tracking-tight">{editingPaymentId ? "Edit Payment" : "Record Payment"}</h3>
                <p className="text-sm text-slate-500">
                  {editingPaymentId ? "Update payment details and save changes" : "Add payment against any active booking"}
                </p>
              </div>
              {editingPaymentId && (
                <button
                  onClick={resetPaymentForm}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Select Booking</label>
                <select
                  value={paymentForm.booking_id}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, booking_id: Number(e.target.value) }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-400"
                >
                  <option value={0}>Select booking</option>
                  {bookingViews.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.guest_name} - {booking.room_number || "-"} - Due {formatK(booking.due)}
                    </option>
                  ))}
                </select>
              </div>
              <InputField
                label="Amount"
                type="number"
                value={String(paymentForm.amount)}
                onChange={(value) => setPaymentForm((prev) => ({ ...prev, amount: Number(value) || 0 }))}
              />
              <SelectField
                label="Payment Method"
                value={paymentForm.payment_method}
                onChange={(value) => setPaymentForm((prev) => ({ ...prev, payment_method: value }))}
                options={["Cash", "Card", "Bank Transfer", "Mobile Transfer"]}
              />
              <InputField
                label="Payment Date"
                type="date"
                value={paymentForm.payment_date}
                onChange={(value) => setPaymentForm((prev) => ({ ...prev, payment_date: value }))}
              />
              <button
                onClick={savePayment}
                className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
              >
                {editingPaymentId ? "Update Payment" : "Save Payment"}
              </button>
            </div>
          </section>
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black tracking-tight">Payment History</h3>
                  <p className="text-sm text-slate-500">Search payments by guest, room, method, or date</p>
                </div>
                <button
                  onClick={() => loadAllData()}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <InputField
                  label="Search Payments"
                  value={paymentSearch}
                  onChange={setPaymentSearch}
                  placeholder="Guest, room, method"
                />
                <SelectField
                  label="Method Filter"
                  value={paymentMethodFilter}
                  onChange={setPaymentMethodFilter}
                  options={["All", "Cash", "Card", "Bank Transfer", "Mobile Transfer"]}
                />
                <InputField
                  label="Payment Date"
                  type="date"
                  value={paymentDateFilter}
                  onChange={setPaymentDateFilter}
                />
                <div className="flex items-end">
                  <button
                    onClick={clearPaymentFilters}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
            <div className="mb-4 text-sm text-slate-500">
              Showing {filteredPayments.length} of {payments.length} payment(s)
            </div>
            <div className="space-y-4">
              {filteredPayments.length === 0 ? (
                <EmptyState title="No payments found" text="Try a different payment search, method, or date." />
              ) : (
                filteredPayments.map((payment) => {
                  const booking = bookingViews.find((item) => item.id === payment.booking_id);
                  return (
                    <div
                      key={payment.id}
                      className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h4 className="font-black">{booking?.guest_name || "Guest"}</h4>
                          <p className="text-sm text-slate-500">Room {booking?.room_number || "-"}</p>
                        </div>
                        <p className="text-lg font-black">{formatK(payment.amount)}</p>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                        <p>Method: {payment.payment_method || "-"}</p>
                        <p>Date: {payment.payment_date || "-"}</p>
                        <p>Booking Ref: {payment.booking_id}</p>
                        <p>Remaining Due: {formatK(booking?.due || 0)}</p>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <button
                          onClick={() => booking && printReceipt(booking.id)}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                        >
                          Print
                        </button>
                        <button
                          onClick={() => booking && openEmailReceipt(booking.id)}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                        >
                          Email
                        </button>
                        <button
                          onClick={() => startEditPayment(payment)}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deletePayment(payment.id, payment.booking_id)}
                          className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </section>
      )}
      {canAccessTab(staffRole, "invoices") && activeTab === "invoices" && (
        <section className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h3 className="text-xl font-black tracking-tight">Invoice Center</h3>
                <p className="text-sm text-slate-500">Preview, print, and email invoices for motel bookings</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:w-[760px]">
                <InputField
                  label="Search Invoices"
                  value={invoiceSearch}
                  onChange={setInvoiceSearch}
                  placeholder="Guest, room, invoice number..."
                />
                <SelectField
                  label="Invoice Status"
                  value={invoiceStatusFilter}
                  onChange={setInvoiceStatusFilter}
                  options={["All", "Paid", "Part Paid", "Unpaid"]}
                />
                <button
                  onClick={() => {
                    setInvoiceSearch("");
                    setInvoiceStatusFilter("All");
                  }}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <PremiumStatCard label="Invoices" value={invoiceStats.count} subtext="Filtered records" />
            <PremiumMoneyCard label="Invoice Total" value={invoiceStats.total} subtext="Total charges" />
            <PremiumMoneyCard label="Paid" value={invoiceStats.paid} subtext="Collected revenue" />
            <PremiumMoneyCard label="Balance Due" value={invoiceStats.due} subtext="Outstanding invoices" />
          </div>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-black tracking-tight">Invoice Register</h3>
                <p className="text-sm text-slate-500">Click print to open a professional invoice window. Use browser Save as PDF if needed.</p>
              </div>
              <button
                onClick={() => loadAllData()}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>
            <div className="space-y-3">
              {invoiceRegister.length === 0 ? (
                <EmptyState title="No invoices found" text="Try a different search or invoice status filter." />
              ) : (
                invoiceRegister.map((invoice) => (
                  <div key={invoice.id} className="rounded-[26px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-black text-slate-900">{invoice.invoiceNumber}</p>
                          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${
                            invoice.invoiceStatus === "Paid"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : invoice.invoiceStatus === "Part Paid"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-rose-200 bg-rose-50 text-rose-700"
                          }`}>
                            {invoice.invoiceStatus}
                          </span>
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${bookingStatusStyles[invoice.status]}`}>
                            {invoice.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {invoice.guest_name} • Room {invoice.room_number || "-"} • {invoice.check_in_date} to {invoice.check_out_date}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">Issue Date: {invoice.issueDate}</p>
                      </div>
                      <div className="grid gap-2 text-sm sm:grid-cols-3 xl:min-w-[420px]">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total</p>
                          <p className="text-lg font-black">{formatK(invoice.total_amount)}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Paid</p>
                          <p className="text-lg font-black">{formatK(invoice.roomPaid)}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Due</p>
                          <p className="text-lg font-black text-rose-700">{formatK(invoice.amountDue)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:w-[520px]">
                      <button
                        onClick={() => printInvoice(invoice.id)}
                        className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Print / Save PDF
                      </button>
                      <button
                        onClick={() => openEmailInvoice(invoice.id)}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                      >
                        Email Invoice
                      </button>
                      <button
                        onClick={() => {
                          setSelectedBookingId(invoice.id);
                          setActiveTab("checkouts");
                        }}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                      >
                        View Booking
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>
      )}

      {canAccessTab(staffRole, "expenses") && activeTab === "expenses" && (
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black tracking-tight">{editingExpenseId ? "Edit Expense" : "Record Expense"}</h3>
                <p className="text-sm text-slate-500">Track operating costs so monthly profit reports are accurate.</p>
              </div>
              {editingExpenseId && (
                <button onClick={resetExpenseForm} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                  Cancel Edit
                </button>
              )}
            </div>
            <div className="space-y-4">
              <InputField label="Expense Date" type="date" value={expenseForm.expense_date} onChange={(value) => setExpenseForm((prev) => ({ ...prev, expense_date: value }))} />
              <SelectField label="Category" value={expenseForm.category} onChange={(value) => setExpenseForm((prev) => ({ ...prev, category: value }))} options={["Maintenance", "Cleaning", "Utilities", "Supplies", "Staff", "Transport", "Other"]} />
              <InputField label="Description" value={expenseForm.description} onChange={(value) => setExpenseForm((prev) => ({ ...prev, description: value }))} placeholder="e.g. Cleaning supplies, plumbing repair" />
              <InputField label="Amount" type="number" value={String(expenseForm.amount)} onChange={(value) => setExpenseForm((prev) => ({ ...prev, amount: Number(value || 0) }))} />
              <SelectField label="Payment Method" value={expenseForm.payment_method} onChange={(value) => setExpenseForm((prev) => ({ ...prev, payment_method: value }))} options={["Cash", "Bank Transfer", "EFTPOS", "Cheque", "Other"]} />
              <InputField label="Recorded By" value={expenseForm.recorded_by} onChange={(value) => setExpenseForm((prev) => ({ ...prev, recorded_by: value }))} placeholder={user?.email || "Staff name"} />
              <TextAreaField label="Notes" value={expenseForm.notes} onChange={(value) => setExpenseForm((prev) => ({ ...prev, notes: value }))} placeholder="Optional notes" />
              <button onClick={saveExpense} disabled={busy} className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
                {editingExpenseId ? "Update Expense" : "Save Expense"}
              </button>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black tracking-tight">Expenses Register</h3>
                  <p className="text-sm text-slate-500">Filter by category and review operating costs.</p>
                </div>
                <button onClick={() => loadAllData()} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Refresh</button>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                <InputField label="Search" value={expenseSearch} onChange={setExpenseSearch} placeholder="Search expense..." />
                <SelectField label="Category" value={expenseCategoryFilter} onChange={setExpenseCategoryFilter} options={["All", "Maintenance", "Cleaning", "Utilities", "Supplies", "Staff", "Transport", "Other"]} />
                <div className="flex items-end">
                  <button onClick={clearExpenseFilters} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50">Clear</button>
                </div>
              </div>
            </div>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filtered Total</p>
                <p className="mt-1 text-2xl font-black">{formatK(filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">This Report Period</p>
                <p className="mt-1 text-2xl font-black">{formatK(phase4Stats.expenseTotal)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Records</p>
                <p className="mt-1 text-2xl font-black">{filteredExpenses.length}</p>
              </div>
            </div>
            <div className="space-y-3">
              {filteredExpenses.length === 0 ? (
                <EmptyState title="No expenses found" text="Add expenses to track actual motel operating cost." />
              ) : (
                filteredExpenses.map((expense) => (
                  <div key={expense.id} className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <p className="font-black">{expense.description}</p>
                        <p className="text-sm text-slate-500">{expense.category || "General"} • {expense.expense_date || "-"}</p>
                        <p className="mt-2 text-sm text-slate-600">Method: {expense.payment_method || "-"} • Recorded by: {expense.recorded_by || "-"}</p>
                        {expense.notes && <p className="mt-2 text-sm text-slate-500">{expense.notes}</p>}
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xl font-black">{formatK(expense.amount)}</p>
                        <div className="mt-3 flex gap-2 sm:justify-end">
                          <button onClick={() => startEditExpense(expense)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Edit</button>
                          <button onClick={() => deleteExpense(expense.id)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50">Delete</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>
      )}

      {canAccessTab(staffRole, "maintenance") && activeTab === "maintenance" && (
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black tracking-tight">{editingMaintenanceId ? "Edit Maintenance" : "Add Maintenance Job"}</h3>
                <p className="text-sm text-slate-500">Log room faults, costs, priorities, and completion status.</p>
              </div>
              {editingMaintenanceId && (
                <button onClick={resetMaintenanceForm} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Cancel Edit</button>
              )}
            </div>
            <div className="space-y-4">
              <SelectField label="Room" value={String(maintenanceForm.room_id)} onChange={(value) => {
                const room = rooms.find((item) => item.id === Number(value));
                setMaintenanceForm((prev) => ({ ...prev, room_id: Number(value), room_number: room?.room_number || "" }));
              }} options={["0", ...rooms.map((room) => String(room.id))]} />
              <InputField label="Room Number" value={maintenanceForm.room_number} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, room_number: value }))} placeholder="Optional if no room selected" />
              <InputField label="Issue Title" value={maintenanceForm.issue_title} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, issue_title: value }))} placeholder="e.g. Aircon not cooling" />
              <TextAreaField label="Issue Description" value={maintenanceForm.issue_description} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, issue_description: value }))} placeholder="Describe the problem" />
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField label="Priority" value={maintenanceForm.priority} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, priority: value }))} options={["Low", "Normal", "High", "Urgent"]} />
                <SelectField label="Status" value={maintenanceForm.status} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, status: value }))} options={["Open", "In Progress", "Waiting Parts", "Completed"]} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <InputField label="Reported Date" type="date" value={maintenanceForm.reported_date} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, reported_date: value }))} />
                <InputField label="Completed Date" type="date" value={maintenanceForm.completed_date} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, completed_date: value }))} />
              </div>
              <InputField label="Cost" type="number" value={String(maintenanceForm.cost)} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, cost: Number(value || 0) }))} />
              <InputField label="Handled By" value={maintenanceForm.handled_by} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, handled_by: value }))} placeholder="Staff or contractor" />
              <TextAreaField label="Notes" value={maintenanceForm.notes} onChange={(value) => setMaintenanceForm((prev) => ({ ...prev, notes: value }))} placeholder="Optional notes" />
              <button onClick={saveMaintenance} disabled={busy} className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
                {editingMaintenanceId ? "Update Maintenance" : "Save Maintenance"}
              </button>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black tracking-tight">Maintenance Register</h3>
                  <p className="text-sm text-slate-500">Open jobs can automatically place rooms into Maintenance status.</p>
                </div>
                <button onClick={() => loadAllData()} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Refresh</button>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                <InputField label="Search" value={maintenanceSearch} onChange={setMaintenanceSearch} placeholder="Search room, issue, staff..." />
                <SelectField label="Status" value={maintenanceStatusFilter} onChange={setMaintenanceStatusFilter} options={["All", "Open", "In Progress", "Waiting Parts", "Completed"]} />
                <div className="flex items-end">
                  <button onClick={clearMaintenanceFilters} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50">Clear</button>
                </div>
              </div>
            </div>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open Jobs</p>
                <p className="mt-1 text-2xl font-black">{phase4Stats.openMaintenance}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Cost</p>
                <p className="mt-1 text-2xl font-black">{formatK(phase4Stats.maintenanceCostTotal)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Records</p>
                <p className="mt-1 text-2xl font-black">{filteredMaintenanceJobs.length}</p>
              </div>
            </div>
            <div className="space-y-3">
              {filteredMaintenanceJobs.length === 0 ? (
                <EmptyState title="No maintenance jobs found" text="Add room maintenance tasks here." />
              ) : (
                filteredMaintenanceJobs.map((job) => (
                  <div key={job.id} className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black">{job.issue_title}</p>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold">{job.status || "Open"}</span>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold">{job.priority || "Normal"}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">Room: {job.room_number || "-"} • Reported: {job.reported_date || "-"}</p>
                        {job.issue_description && <p className="mt-2 text-sm text-slate-600">{job.issue_description}</p>}
                        <p className="mt-2 text-sm text-slate-500">Handled by: {job.handled_by || "-"} • Completed: {job.completed_date || "-"}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xl font-black">{formatK(job.cost)}</p>
                        <div className="mt-3 flex gap-2 sm:justify-end">
                          <button onClick={() => startEditMaintenance(job)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Edit</button>
                          <button onClick={() => deleteMaintenance(job.id)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50">Delete</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>
      )}

      {canAccessTab(staffRole, "audit_logs") && activeTab === "audit_logs" && (
        <section className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h3 className="text-xl font-black tracking-tight">Audit Logs</h3>
                <p className="text-sm text-slate-500">Tracks staff actions such as bookings, payments, room updates, check-outs, expenses, and maintenance changes.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <InputField
                  label="Search Logs"
                  value={auditSearch}
                  onChange={setAuditSearch}
                  placeholder="Staff, action, guest, room..."
                />
                <SelectField
                  label="Action"
                  value={auditActionFilter}
                  onChange={setAuditActionFilter}
                  options={["All", "CREATE", "UPDATE", "DELETE", "STATUS", "CHECK_OUT", "KEY_DEPOSIT_RECEIVED", "KEY_DEPOSIT_REFUNDED"]}
                />
                <button
                  onClick={clearAuditFilters}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <PremiumStatCard label="Total Logs" value={auditLogs.length} subtext="Latest 300 loaded" />
            <PremiumStatCard label="Creates" value={auditLogs.filter((log) => log.action_type === "CREATE").length} subtext="New records" />
            <PremiumStatCard label="Updates" value={auditLogs.filter((log) => log.action_type === "UPDATE" || log.action_type === "STATUS").length} subtext="Changed records" />
            <PremiumStatCard label="Deletes" value={auditLogs.filter((log) => log.action_type === "DELETE").length} subtext="Removed records" />
          </div>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black tracking-tight">Recent System Activity</h3>
                <p className="text-sm text-slate-500">Use this for accountability when staff ask who changed what.</p>
              </div>
            </div>
            <div className="space-y-3">
              {filteredAuditLogs.length === 0 ? (
                <EmptyState title="No audit logs found" text="Create or update a record, then come back here to see the action history." />
              ) : (
                filteredAuditLogs.map((log) => (
                  <div key={log.id} className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-700">
                            {log.action_type || "ACTION"}
                          </span>
                          <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                            {log.table_name || "table"}
                          </span>
                          <span className="text-xs text-slate-400">Record: {log.record_id || "-"}</span>
                        </div>
                        <p className="mt-3 font-semibold text-slate-900">{log.description || "No description"}</p>
                        <p className="mt-1 text-sm text-slate-500">Staff: {log.staff_email || "system"}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-500">
                        {log.created_at ? new Date(log.created_at).toLocaleString("en-GB") : "-"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>
      )}


      {canAccessTab(staffRole, "reports") && activeTab === "reports" && (
        <section className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h3 className="text-xl font-black tracking-tight">Reports Center</h3>
                <p className="text-sm text-slate-500">Track revenue, payments, occupancy, and outstanding balances</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <InputField
                  label="Start Date"
                  type="date"
                  value={reportStartDate}
                  onChange={setReportStartDate}
                />
                <InputField
                  label="End Date"
                  type="date"
                  value={reportEndDate}
                  onChange={setReportEndDate}
                />
                <button
                  onClick={() => {
                    setReportStartDate(firstDayOfMonth());
                    setReportEndDate(todayDate());
                  }}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                >
                  This Month
                </button>
                <button
                  onClick={printReport}
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Print Report
                </button>
              </div>
            </div>
          </section>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <PremiumMoneyCard label="Revenue" value={reportStats.revenue} subtext="Selected range" />
            <PremiumStatCard label="Payments" value={reportStats.totalPayments} subtext="Transactions" />
            <PremiumStatCard label="Bookings" value={reportStats.totalBookings} subtext="Within range" />
            <PremiumStatCard label="Checked In" value={reportStats.checkedIn} subtext="Live occupied stays" />
            <PremiumMoneyCard label="Outstanding" value={reportStats.totalOutstanding} subtext="All unpaid balances" />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-black tracking-tight">Room Status Summary</h3>
                <p className="text-sm text-slate-500">Current live room operations</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <MiniReportCard label="Available Rooms" value={reportStats.availableRooms} />
                <MiniReportCard label="Occupied Rooms" value={reportStats.occupiedRooms} />
                <MiniReportCard label="Cleaning Rooms" value={reportStats.cleaningRooms} />
                <MiniReportCard label="Maintenance Rooms" value={reportStats.maintenanceRooms} />
                <MiniReportCard label="Reserved in Range" value={reportStats.reservedInRange} />
                <MiniReportCard label="Checked Out in Range" value={reportStats.checkedOutInRange} />
              </div>
            </section>
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-black tracking-tight">Payment Method Summary</h3>
                <p className="text-sm text-slate-500">Revenue grouped by collection method</p>
              </div>
              <div className="space-y-3">
                {Object.keys(reportStats.paymentMethodTotals).length === 0 ? (
                  <EmptyState title="No payments in range" text="Try a different date range to view payment totals." />
                ) : (
                  Object.entries(reportStats.paymentMethodTotals).map(([method, total]) => (
                    <div
                      key={method}
                      className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{method}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Payment method</p>
                      </div>
                      <p className="text-lg font-black text-slate-900">{formatK(total)}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-black tracking-tight">Outstanding Balances</h3>
                <p className="text-sm text-slate-500">Bookings that still have money due</p>
              </div>
              <div className="space-y-3">
                {reportStats.outstandingBookings.length === 0 ? (
                  <EmptyState title="No outstanding balances" text="All current bookings are fully paid." />
                ) : (
                  reportStats.outstandingBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black">{booking.guest_name}</p>
                          <p className="text-sm text-slate-500">
                            Room {booking.room_number || "-"} • {booking.check_in_date} to {booking.check_out_date}
                          </p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${bookingStatusStyles[booking.status]}`}>
                          {booking.status}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                        <p>Total: {formatK(booking.total_amount)}</p>
                        <p>Paid: {formatK(booking.paid)}</p>
                        <p className="font-bold">Due: {formatK(booking.due)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-black tracking-tight">Outstanding Invoices</h3>
                <p className="text-sm text-slate-500">Accounts receivable and unpaid balances</p>
              </div>
              <div className="space-y-3">
                {outstandingInvoices.length === 0 ? (
                  <EmptyState title="No outstanding invoices" text="All invoices are fully paid." />
                ) : (
                  outstandingInvoices.slice(0, 12).map((invoice) => (
                    <div
                      key={invoice.id}
                      className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black">{invoice.guest_name}</p>
                          <p className="text-sm text-slate-500">
                            {invoice.invoiceNumber} • Room {invoice.room_number || "-"}
                          </p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          {invoice.invoiceStatus}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                        <p>Total Charges: {formatK(invoice.total_amount)}</p>
                        <p>Paid: {formatK(invoice.roomPaid)}</p>
                        <p className="font-bold">Balance Due: {formatK(invoice.amountDue)}</p>
                        <p>Issue Date: {invoice.issueDate}</p>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => printInvoice(invoice.id)}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                        >
                          Print Invoice
                        </button>
                        <button
                          onClick={() => openEmailInvoice(invoice.id)}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                        >
                          Email Invoice
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-black tracking-tight">Recent Payments in Range</h3>
                <p className="text-sm text-slate-500">Latest collected payments for selected dates</p>
              </div>
              <div className="space-y-3">
                {reportPayments.length === 0 ? (
                  <EmptyState title="No payments found" text="No payment was recorded for the selected date range." />
                ) : (
                  reportPayments.slice(0, 12).map((payment) => {
                    const booking = bookingViews.find((item) => item.id === payment.booking_id);
                    return (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">{booking?.guest_name || "Guest"}</p>
                          <p className="text-sm text-slate-500">
                            {payment.payment_date || "-"} • {payment.payment_method || "Unknown"}
                          </p>
                        </div>
                        <p className="text-lg font-black text-slate-900">{formatK(payment.amount)}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-black tracking-tight">Recent Check-Out Report</h3>
                <p className="text-sm text-slate-500">Completed check-outs with final transaction summary</p>
              </div>
              <div className="space-y-3">
                {recentCheckoutSummary.length === 0 ? (
                  <EmptyState title="No check-out records" text="Completed check-outs will appear here for reporting." />
                ) : (
                  recentCheckoutSummary.slice(0, 10).map((item) => (
                    <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black">{item.guest_name}</p>
                          <p className="text-sm text-slate-500">Room {item.room_number || "-"} • {item.check_out_date}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${bookingStatusStyles[item.status]}`}>
                          {item.status}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                        <p>Final Payment: {formatK(item.finalCheckoutPayment)}</p>
                        <p>Deposit Refunded: {formatK(item.keyDepositRefundedAtCheckout)}</p>
                        <p>Total Room Paid: {formatK(item.finalRoomPaid)}</p>
                        <p>Final Balance: {formatK(item.finalBalance)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-black tracking-tight">Check-Out Totals</h3>
                <p className="text-sm text-slate-500">High-level summary of completed check-out transactions</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <PremiumStatCard label="Total Check-Outs" value={checkoutReportStats.totalCheckouts} subtext="Completed" />
                <PremiumMoneyCard label="Check-Out Revenue" value={checkoutReportStats.checkoutRevenue} subtext="Collected at checkout" />
                <PremiumMoneyCard label="Deposits Refunded" value={checkoutReportStats.refundedDeposits} subtext="Returned to guests" />
              </div>
            </section>
          </div>
        </section>

      )}
    </AppShell>
  );
}
function SidebarButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
function MobileTabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-sm font-medium ${
        active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}
function PremiumStatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: number;
  subtext: string;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{subtext}</p>
    </div>
  );
}
function PremiumMoneyCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: number;
  subtext: string;
}) {
  return (
    <div className="rounded-[28px] border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{formatK(value)}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{subtext}</p>
    </div>
  );
}
function MiniReportCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{value}</p>
    </div>
  );
}
function DailyWidget({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number;
  subtitle: string;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{subtitle}</p>
    </div>
  );
}
function DailyMoneyWidget({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number;
  subtitle: string;
}) {
  return (
    <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{formatK(value)}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{subtitle}</p>
    </div>
  );
}
function CompactBookingCard({ booking }: { booking: any }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black">{booking.guest_name}</p>
          <p className="text-sm text-slate-500">
            Room {booking.room_number || "-"} • {booking.room?.room_type || "Room"}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${bookingStatusStyles[booking.status]}`}>
          {booking.status}
        </span>
      </div>
    </div>
  );
}
function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 backdrop-blur">
      <h3 className="text-lg font-black">{title}</h3>
      <p className="mt-2 text-sm text-slate-300">{text}</p>
    </div>
  );
}
function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <h4 className="text-lg font-black text-slate-800">{title}</h4>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </div>
  );
}
function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-indigo-400"
      />
    </div>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-indigo-400"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[100px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-indigo-400"
      />
    </div>
  );

}

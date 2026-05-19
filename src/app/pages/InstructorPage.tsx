import { useState, useEffect, useMemo } from "react";
import { usePageTitle } from "../hooks/usePageTitle";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  GraduationCap, Plus, Pencil, Trash2, CheckCircle2, Clock, XCircle,
  BookOpen, TrendingUp, Users, Loader2, X, AlertCircle, Eye, EyeOff,
  ListChecks, Image as ImageIcon, ArrowRight,
  CreditCard, Copy, CheckCheck, Banknote, ShieldCheck,
  ClipboardList, Globe, Hash, Search, Sparkles, Coins,
  FileText, Wallet,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { testsApi } from "../../api/client";
import type { TestSummary } from "../../api/client";

type Course = {
  id: number; title: string; description: string; content: string;
  price: number; category: string; level: string; duration: string;
  image: string; status: string; students_count: number;
  active_students: number; pending_payments: number;
};

const CATEGORIES = [
  { value: "web",    label: "🌐 Веб" },
  { value: "mobile", label: "📱 Мобайл" },
  { value: "devops", label: "⚙️ DevOps" },
  { value: "design", label: "🎨 Дизайн" },
  { value: "other",  label: "✨ Другое" },
];
const LEVELS = [
  { value: "beginner",     label: "Начинающий" },
  { value: "intermediate", label: "Средний" },
  { value: "advanced",     label: "Продвинутый" },
];

const STATUS: Record<string, { label: string; bg: string; text: string; border: string; icon: React.ElementType }> = {
  pending:  { label: "На проверке", bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200",    icon: Clock },
  approved: { label: "Опубликован",  bg: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-200",  icon: CheckCircle2 },
  rejected: { label: "Отклонён",     bg: "bg-red-50",      text: "text-red-700",      border: "border-red-200",      icon: XCircle },
};

const EMPTY = { title: "", description: "", content: "", price: "0", category: "web", level: "beginner", duration: "", image: "" };
const PAYMENT_PHONE = import.meta.env.VITE_PAYMENT_PHONE || "+7 707 994 94 69";

export function InstructorPage() {
  usePageTitle("Кабинет инструктора — AZIRAL Learn");
  const { user } = useAuth();
  const [courses, setCourses]     = useState<Course[]>([]);
  const [earnings, setEarnings]   = useState({ gross: 0, net: 0, platform: 0 });
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<"create" | "edit" | null>(null);
  const [editId, setEditId]       = useState<number | null>(null);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [programItems, setProgramItems] = useState<string[]>([""]);
  const [courseSearch, setCourseSearch] = useState("");
  const [testSearch, setTestSearch]     = useState("");

  // Apply flow
  const [applyLoading, setApplyLoading]   = useState(true);
  const [applyStatus, setApplyStatus]     = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [applying, setApplying]           = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [copied, setCopied]               = useState(false);
  const [applyForm, setApplyForm]         = useState({ bio: "", experience: "", team_name: "" });

  const location = useLocation();
  const isInstructor = user?.role === "instructor" || user?.role === "admin";
  const h = { "Content-Type": "application/json" };

  // Tabs
  const [activeTab, setActiveTab] = useState<"courses" | "tests">(
    (location.state as { tab?: string } | null)?.tab === "tests" ? "tests" : "courses"
  );

  // Tests state
  const [tests, setTests]               = useState<TestSummary[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [deletingTest, setDeletingTest] = useState<number | null>(null);
  const [confirmDelTest, setConfirmDelTest] = useState<number | null>(null);
  const [togglingTest, setTogglingTest] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    if (isInstructor) {
      loadData();
      loadTests(); // загружаем сразу, чтобы счётчики были актуальны
    } else {
      checkApply();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    const [cRes, eRes] = await Promise.all([
      fetch("/api/instructor/courses", { credentials: 'include', headers: h }),
      fetch("/api/instructor/earnings", { credentials: 'include', headers: h }),
    ]);
    if (cRes.ok) setCourses(await cRes.json());
    if (eRes.ok) setEarnings(await eRes.json());
    setLoading(false);
  };

  const loadTests = async () => {
    setTestsLoading(true);
    try {
      const data = await testsApi.myTests();
      setTests(data);
    } finally { setTestsLoading(false); }
  };

  const handleCreateTest = async () => {
    try {
      const test = await testsApi.create({ title: "Новый тест" });
      window.location.href = `/instructor/tests/${test.id}/build`;
    } catch { /* ignore */ }
  };

  const handleDeleteTest = async (id: number) => {
    setDeletingTest(id);
    try {
      await testsApi.delete(id);
      setTests(prev => prev.filter(t => t.id !== id));
      setConfirmDelTest(null);
    } finally { setDeletingTest(null); }
  };

  const handleToggleTestPublish = async (test: TestSummary) => {
    setTogglingTest(test.id);
    try {
      const res = await testsApi.togglePublish(test.id);
      setTests(prev => prev.map(t => t.id === test.id ? { ...t, status: res.status } : t));
    } finally { setTogglingTest(null); }
  };

  const checkApply = async () => {
    setApplyLoading(true);
    const r = await fetch("/api/instructor/apply", { credentials: 'include', headers: h }).catch(() => null);
    if (r?.ok) {
      const d = await r.json();
      setApplyStatus(d?.status || null);
      setPaymentStatus(d?.payment_status || null);
    }
    setApplyLoading(false);
  };

  const handleApply = async () => {
    setApplying(true);
    const r = await fetch("/api/instructor/apply", {
      method: "POST", credentials: 'include', headers: h, body: JSON.stringify(applyForm),
    }).catch(() => null);
    if (r?.ok) {
      const d = await r.json();
      setApplyStatus(d.status);
      setPaymentStatus(d.payment_status);
    }
    setApplying(false);
  };

  const handlePaymentSent = async () => {
    setConfirmingPayment(true);
    const r = await fetch("/api/instructor/apply/payment", { method: "POST", credentials: 'include', headers: h }).catch(() => null);
    if (r?.ok) setPaymentStatus("sent");
    setConfirmingPayment(false);
  };

  const copyKaspi = () => {
    navigator.clipboard.writeText(PAYMENT_PHONE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openCreate = () => {
    setForm(EMPTY); setProgramItems([""]); setFormError(""); setEditId(null); setModal("create");
  };
  const openEdit = (c: Course) => {
    const items = (() => {
      if (!c.content) return [""];
      try { return JSON.parse(c.content); } catch { return c.content.split("\n").filter(Boolean); }
    })();
    setForm({ title: c.title, description: c.description || "", content: c.content || "", price: String(c.price), category: c.category, level: c.level, duration: c.duration || "", image: c.image || "" });
    setProgramItems(items.length ? items : [""]);
    setEditId(c.id); setFormError(""); setModal("edit");
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setFormError("Введите название курса"); return; }
    setSaving(true); setFormError("");
    const content = JSON.stringify(programItems.filter(Boolean));
    const body = { ...form, price: Number(form.price), content };
    const url = modal === "edit" ? `/api/courses/${editId}` : "/api/courses";
    const method = modal === "edit" ? "PATCH" : "POST";
    const r = await fetch(url, { method, credentials: 'include', headers: h, body: JSON.stringify(body) }).catch(() => null);
    if (r?.ok) { setModal(null); loadData(); }
    else { const d = await r?.json().catch(() => ({})); setFormError(d?.error || "Ошибка сохранения"); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    await fetch(`/api/courses/${id}`, { method: "DELETE", credentials: 'include', headers: h }).catch(() => null);
    setConfirmDel(null); setDeleting(null); loadData();
  };

  const addProgramItem = () => setProgramItems(p => [...p, ""]);
  const updateItem = (i: number, val: string) => setProgramItems(p => p.map((x, j) => j === i ? val : x));
  const removeItem = (i: number) => setProgramItems(p => p.filter((_, j) => j !== i));

  // Filtered lists
  const filteredCourses = useMemo(() => {
    const q = courseSearch.toLowerCase().trim();
    if (!q) return courses;
    return courses.filter(c =>
      c.title.toLowerCase().includes(q) ||
      (c.description || "").toLowerCase().includes(q) ||
      (c.category || "").toLowerCase().includes(q)
    );
  }, [courses, courseSearch]);

  const filteredTests = useMemo(() => {
    const q = testSearch.toLowerCase().trim();
    if (!q) return tests;
    return tests.filter(t =>
      (t.title || "").toLowerCase().includes(q) ||
      (t.category || "").toLowerCase().includes(q)
    );
  }, [tests, testSearch]);

  // ── NOT LOGGED IN ──
  if (!user) return (
    <div className="min-h-screen bg-[#F5F3EE] flex flex-col items-center justify-center pt-24 gap-4 px-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0047FF] to-[#3366FF] flex items-center justify-center shadow-lg shadow-[#0047FF]/20">
        <GraduationCap className="w-8 h-8 text-white" />
      </div>
      <p className="text-[#3A3A3A] text-lg font-medium">Нужно войти в аккаунт</p>
      <Link to="/login" className="px-5 py-2.5 bg-[#0047FF] hover:bg-[#0038CC] text-white rounded-xl text-sm font-medium transition-colors shadow-sm shadow-[#0047FF]/20">Войти</Link>
    </div>
  );

  // ── APPLY PAGE ──
  if (!isInstructor) return (
    <div className="min-h-screen bg-[#F5F3EE] pt-24 pb-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-[#0047FF] to-[#3366FF] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-[#0047FF]/25">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl text-[#0A0A0A] font-bold mb-3">Стать инструктором</h1>
          <p className="text-[#6B6B6B] text-lg">
            Создавайте курсы и зарабатывайте{" "}
            <span className="text-[#0047FF] font-semibold">80% от каждой продажи</span>
          </p>
        </motion.div>

        {/* Benefits */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3 mb-8">
          {[
            { v: "80%",    l: "Ваш доход",        c: "text-emerald-600", bg: "bg-emerald-500/10" },
            { v: "5 000₸", l: "Разовый взнос",    c: "text-[#0047FF]",   bg: "bg-[#0047FF]/10" },
            { v: "∞",      l: "Курсов без лимита", c: "text-purple-600",  bg: "bg-purple-500/10" },
          ].map(b => (
            <div key={b.l} className="text-center p-4 bg-white border border-[#E8E5DF] rounded-2xl">
              <p className={`text-2xl font-bold mb-1 ${b.c}`}>{b.v}</p>
              <p className="text-[#6B6B6B] text-xs">{b.l}</p>
            </div>
          ))}
        </motion.div>

        {/* Progress steps */}
        {!applyLoading && applyStatus !== "rejected" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
            className="flex items-center gap-0 mb-8">
            {[
              { label: "Заявка",    done: !!applyStatus },
              { label: "Оплата",    done: paymentStatus === "sent" || paymentStatus === "confirmed" },
              { label: "Проверка",  done: paymentStatus === "confirmed" },
              { label: "Готово",    done: applyStatus === "approved" },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    step.done ? "bg-[#0047FF] border-[#0047FF] text-white shadow-sm shadow-[#0047FF]/30" : "bg-white border-[#E8E5DF] text-[#A0A0A0]"
                  }`}>
                    {step.done ? <CheckCheck className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-xs mt-1.5 font-medium ${step.done ? "text-[#0047FF]" : "text-[#A0A0A0]"}`}>{step.label}</span>
                </div>
                {i < arr.length - 1 && <div className={`h-0.5 flex-1 mb-5 mx-1 transition-all ${step.done ? "bg-[#0047FF]/40" : "bg-[#E8E5DF]"}`} />}
              </div>
            ))}
          </motion.div>
        )}

        {applyLoading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-[#0047FF] border-t-transparent rounded-full animate-spin" /></div>

        ) : applyStatus === "rejected" ? (
          /* ── REJECTED ── */
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="bg-white border border-red-200 rounded-2xl p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
              <XCircle className="w-7 h-7 text-red-500" />
            </div>
            <div>
              <h2 className="text-[#0A0A0A] text-xl font-bold mb-2">Заявка отклонена</h2>
              <p className="text-[#6B6B6B] text-sm">
                Напишите нам на{" "}
                <a href="mailto:aziralgroup@outlook.com" className="text-[#0047FF] hover:underline font-medium">aziralgroup@outlook.com</a>{" "}
                для уточнения деталей.
              </p>
            </div>
            <button onClick={() => { setApplyStatus(null); setPaymentStatus(null); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#F5F3EE] border border-[#E8E5DF] text-[#3A3A3A] hover:bg-[#F0EEE9] rounded-xl text-sm font-medium transition-colors">
              <ArrowRight className="w-4 h-4" /> Подать повторно
            </button>
          </motion.div>

        ) : !applyStatus ? (
          /* ── STEP 1: FORM ── */
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
            className="bg-white border border-[#E8E5DF] rounded-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-start gap-2 p-3 bg-[#0047FF]/5 border border-[#0047FF]/15 rounded-xl">
              <Banknote className="w-4 h-4 text-[#0047FF] shrink-0 mt-0.5" />
              <p className="text-[#0047FF] text-sm">После заполнения формы вам нужно будет оплатить взнос <span className="font-semibold">5 000 ₸</span> через Kaspi</p>
            </div>
            <div>
              <label className="block text-[#3A3A3A] text-sm font-medium mb-2">Название команды / бренда</label>
              <input value={applyForm.team_name} onChange={e => setApplyForm(p => ({ ...p, team_name: e.target.value }))}
                placeholder="Например: DevAcademy, Code Team KZ..."
                className="w-full bg-white border border-[#E8E5DF] focus:border-[#0047FF] focus:ring-2 focus:ring-[#0047FF]/15 rounded-xl px-4 py-3 text-[#0A0A0A] placeholder-[#A0A0A0] outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-[#3A3A3A] text-sm font-medium mb-2">О себе</label>
              <textarea value={applyForm.bio} onChange={e => setApplyForm(p => ({ ...p, bio: e.target.value }))} rows={3}
                placeholder="Расскажите кто вы и чем занимаетесь..."
                className="w-full bg-white border border-[#E8E5DF] focus:border-[#0047FF] focus:ring-2 focus:ring-[#0047FF]/15 rounded-xl px-4 py-3 text-[#0A0A0A] placeholder-[#A0A0A0] outline-none transition-all resize-none text-sm" />
            </div>
            <div>
              <label className="block text-[#3A3A3A] text-sm font-medium mb-2">Какие курсы хотите создавать</label>
              <textarea value={applyForm.experience} onChange={e => setApplyForm(p => ({ ...p, experience: e.target.value }))} rows={3}
                placeholder="Опишите тематику курсов, ваш опыт в этой сфере..."
                className="w-full bg-white border border-[#E8E5DF] focus:border-[#0047FF] focus:ring-2 focus:ring-[#0047FF]/15 rounded-xl px-4 py-3 text-[#0A0A0A] placeholder-[#A0A0A0] outline-none transition-all resize-none text-sm" />
            </div>
            <button onClick={handleApply} disabled={applying || !applyForm.bio.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#0047FF] hover:bg-[#0038CC] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all shadow-sm shadow-[#0047FF]/20">
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Продолжить к оплате</>}
            </button>
          </motion.div>

        ) : (paymentStatus === "awaiting" || (applyStatus && !paymentStatus)) ? (
          /* ── STEP 2: PAYMENT ── */
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="space-y-4">
            {/* Amount */}
            <div className="bg-white border border-[#0047FF]/20 rounded-2xl p-6 text-center">
              <div className="w-12 h-12 mx-auto bg-[#0047FF]/10 rounded-2xl flex items-center justify-center mb-3">
                <CreditCard className="w-6 h-6 text-[#0047FF]" />
              </div>
              <p className="text-[#6B6B6B] text-sm mb-1">К оплате</p>
              <p className="text-4xl font-bold text-[#0A0A0A] mb-1">5 000 <span className="text-[#0047FF]">₸</span></p>
              <p className="text-[#6B6B6B] text-sm">Разовый взнос за доступ к платформе инструктора</p>
            </div>

            {/* Kaspi pay details */}
            <div className="bg-white border border-[#E8E5DF] rounded-2xl p-6 space-y-4">
              <h3 className="text-[#0A0A0A] font-semibold flex items-center gap-2">
                <span className="w-7 h-7 bg-red-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">K</span>
                Оплата через Kaspi
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#F5F3EE] border border-[#E8E5DF] rounded-xl">
                  <div>
                    <p className="text-[#6B6B6B] text-xs mb-0.5">Номер телефона</p>
                    <p className="text-[#0A0A0A] font-mono font-medium">{PAYMENT_PHONE}</p>
                  </div>
                  <button onClick={copyKaspi}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0047FF]/10 border border-[#0047FF]/20 text-[#0047FF] hover:bg-[#0047FF]/15 rounded-lg text-xs font-medium transition-all">
                    {copied ? <><CheckCheck className="w-3.5 h-3.5" /> Скопировано</> : <><Copy className="w-3.5 h-3.5" /> Копировать</>}
                  </button>
                </div>

                <div className="p-3 bg-[#F5F3EE] border border-[#E8E5DF] rounded-xl">
                  <p className="text-[#6B6B6B] text-xs mb-0.5">Получатель</p>
                  <p className="text-[#0A0A0A] font-medium">Олжас А.</p>
                </div>

                <div className="p-3 bg-[#F5F3EE] border border-[#E8E5DF] rounded-xl">
                  <p className="text-[#6B6B6B] text-xs mb-0.5">Сумма</p>
                  <p className="text-[#0A0A0A] font-medium">5 000 ₸</p>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-amber-800 text-xs flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                    <span>В комментарии к переводу укажите ваш email: <span className="font-semibold">{user.email}</span></span>
                  </p>
                </div>
              </div>
            </div>

            {/* Confirm button */}
            <button onClick={handlePaymentSent} disabled={confirmingPayment}
              className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 active:scale-[0.99] disabled:opacity-50 text-white rounded-2xl font-semibold text-base transition-all shadow-lg shadow-emerald-600/20">
              {confirmingPayment ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Я оплатил — уведомить администратора</>}
            </button>
            <p className="text-center text-[#A0A0A0] text-xs">Нажмите кнопку только после того, как отправили перевод</p>
          </motion.div>

        ) : paymentStatus === "sent" ? (
          /* ── STEP 3: AWAITING PAYMENT CONFIRMATION ── */
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="bg-white border border-blue-200 rounded-2xl p-8 text-center space-y-3">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto">
              <CreditCard className="w-7 h-7 text-blue-600" />
            </div>
            <h2 className="text-[#0A0A0A] text-xl font-bold">Оплата проверяется</h2>
            <p className="text-[#6B6B6B] text-sm max-w-md mx-auto">Администратор проверяет ваш платёж. Обычно это занимает до нескольких часов. Вы получите уведомление в личном кабинете.</p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-blue-600 text-sm font-medium">Ожидаем подтверждения</span>
            </div>
          </motion.div>

        ) : paymentStatus === "confirmed" ? (
          /* ── STEP 4: APPLICATION REVIEW ── */
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="bg-white border border-amber-200 rounded-2xl p-8 text-center space-y-3">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-[#0A0A0A] text-xl font-bold">Заявка на рассмотрении</h2>
            <p className="text-[#6B6B6B] text-sm max-w-md mx-auto">Оплата подтверждена ✓ Теперь администратор рассматривает вашу заявку. Обычно это занимает до 24 часов.</p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-amber-700 text-sm font-medium">Рассматривается</span>
            </div>
          </motion.div>

        ) : applyStatus === "approved" ? (
          /* ── APPROVED but role not updated yet ── */
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="bg-white border border-emerald-200 rounded-2xl p-8 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-[#0A0A0A] text-xl font-bold">Поздравляем! Заявка одобрена</h2>
            <p className="text-[#6B6B6B] text-sm max-w-md mx-auto">Ваша заявка одобрена администратором. Обновите страницу чтобы войти в кабинет инструктора.</p>
            <button onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0047FF] hover:bg-[#0038CC] text-white rounded-xl text-sm font-medium transition-colors shadow-sm shadow-[#0047FF]/20">
              Обновить страницу
            </button>
          </motion.div>

        ) : null}
      </div>
    </div>
  );

  // ── DASHBOARD ──
  const publishedCount = courses.filter(c => c.status === "approved").length;
  const pendingCount = courses.filter(c => c.status === "pending").length;
  const totalStudents = courses.reduce((a, c) => a + (c.active_students || 0), 0);
  const totalPending = courses.reduce((a, c) => a + (c.pending_payments || 0), 0);

  return (
    <div className="min-h-screen bg-[#F5F3EE] pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0047FF] to-[#3366FF] flex items-center justify-center shadow-lg shadow-[#0047FF]/20 shrink-0">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl text-[#0A0A0A] font-bold tracking-tight">Кабинет инструктора</h1>
              <p className="text-[#6B6B6B] text-sm sm:text-base mt-1">Добро пожаловать, {user.name} 👋</p>
            </div>
          </div>
          {activeTab === "courses" ? (
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0047FF] hover:bg-[#0038CC] active:scale-[0.97] text-white text-sm font-medium rounded-xl transition-all shadow-sm shadow-[#0047FF]/20 shrink-0">
              <Plus className="w-4 h-4" /> Новый курс
            </button>
          ) : (
            <button onClick={handleCreateTest}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0047FF] hover:bg-[#0038CC] active:scale-[0.97] text-white text-sm font-medium rounded-xl transition-all shadow-sm shadow-[#0047FF]/20 shrink-0">
              <Plus className="w-4 h-4" /> Новый тест
            </button>
          )}
        </div>

        {/* Stats — always visible, even on tests tab */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: pluralCourses(courses.length), value: courses.length, icon: BookOpen, accent: "bg-[#0047FF]/10 text-[#0047FF]", sub: publishedCount > 0 ? `${publishedCount} опубл.` : null },
            { label: pluralTests(tests.length), value: tests.length, icon: ClipboardList, accent: "bg-purple-500/10 text-purple-600", sub: tests.filter(t => t.status === "published").length > 0 ? `${tests.filter(t => t.status === "published").length} опубл.` : null },
            { label: pluralStudents(totalStudents), value: totalStudents, icon: Users, accent: "bg-emerald-500/10 text-emerald-600", sub: null },
            { label: "Заработано", value: `${earnings.net.toLocaleString()} ₸`, icon: Wallet, accent: "bg-amber-500/10 text-amber-600", sub: earnings.gross > 0 ? `оборот ${earnings.gross.toLocaleString()} ₸` : null },
          ].map(s => (
            <div key={s.label} className="bg-white border border-[#E8E5DF] rounded-2xl p-4 hover:border-[#0047FF]/20 hover:shadow-sm transition-all">
              <div className={`w-10 h-10 rounded-xl ${s.accent} flex items-center justify-center mb-3`}>
                <s.icon className="w-5 h-5" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-[#0A0A0A] leading-tight">{s.value}</p>
              <p className="text-[#6B6B6B] text-xs mt-0.5">{s.label}</p>
              {s.sub && <p className="text-[#8A8A8A] text-[11px] mt-1">{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Quick Start guide — show only when truly empty */}
        {!loading && courses.length === 0 && tests.length === 0 && earnings.gross === 0 && (
          <div className="bg-gradient-to-br from-[#0047FF] to-[#3366FF] rounded-2xl p-6 sm:p-8 mb-6 text-white relative overflow-hidden">
            {/* Decorative background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">С чего начать</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">Добро пожаловать в кабинет! 🎉</h2>
              <p className="text-white/80 text-sm sm:text-base mb-6 max-w-2xl">
                Здесь вы создаёте курсы и тесты для своих студентов. Получаете <strong>80%</strong> от каждой продажи и работаете в удобном инструменте.
              </p>

              <div className="grid sm:grid-cols-2 gap-3">
                <button onClick={openCreate}
                  className="group flex items-start gap-3 text-left bg-white/10 hover:bg-white/15 active:scale-[0.98] backdrop-blur-sm border border-white/15 rounded-xl p-4 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-sm">Создайте курс</p>
                      <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-xs text-white/70 leading-snug">Уроки, программа, цена — всё в одном месте</p>
                  </div>
                </button>

                <button onClick={handleCreateTest}
                  className="group flex items-start gap-3 text-left bg-white/10 hover:bg-white/15 active:scale-[0.98] backdrop-blur-sm border border-white/15 rounded-xl p-4 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-sm">Создайте тест</p>
                      <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-xs text-white/70 leading-snug">Опросник для проверки знаний — публикуется в /study</p>
                  </div>
                </button>
              </div>

              <div className="grid sm:grid-cols-3 gap-2 mt-5 pt-5 border-t border-white/15">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span className="text-xs text-white/80">80% от продаж — вам</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span className="text-xs text-white/80">Без лимита на курсы</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span className="text-xs text-white/80">AI-помощник для вопросов</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Revenue banner */}
        {earnings.gross > 0 && (
          <div className="bg-gradient-to-r from-emerald-50 to-emerald-50/50 border border-emerald-200 rounded-2xl p-5 mb-6 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-500/15 rounded-xl flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-[#0A0A0A] text-sm font-semibold">Общий доход с продаж курсов</p>
                <p className="text-[#6B6B6B] text-xs">Платформа удерживает 20%, остальное — ваше</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="text-center px-4 py-2 bg-white/60 rounded-xl">
                <p className="text-emerald-700 font-bold text-lg leading-tight">{earnings.net.toLocaleString()} ₸</p>
                <p className="text-[#6B6B6B] text-[11px]">Ваши 80%</p>
              </div>
              <div className="text-center px-4 py-2 bg-white/60 rounded-xl">
                <p className="text-[#6B6B6B] font-bold text-lg leading-tight">{earnings.platform.toLocaleString()} ₸</p>
                <p className="text-[#A0A0A0] text-[11px]">Платформа 20%</p>
              </div>
            </div>
          </div>
        )}

        {/* Pending alerts */}
        {(pendingCount > 0 || totalPending > 0) && (
          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            {pendingCount > 0 && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-amber-800 font-medium text-sm">{pendingCount} {pluralCourses(pendingCount)} на проверке</p>
                  <p className="text-amber-700 text-xs">Администратор проверяет, обычно до 24 часов</p>
                </div>
              </div>
            )}
            {totalPending > 0 && (
              <div className="flex items-center gap-3 p-4 bg-[#0047FF]/5 border border-[#0047FF]/20 rounded-2xl">
                <Coins className="w-5 h-5 text-[#0047FF] shrink-0" />
                <div>
                  <p className="text-[#0047FF] font-medium text-sm">{totalPending} заявок ожидают оплаты</p>
                  <p className="text-[#3A3A3A] text-xs">Студенты записались, но ещё не оплатили</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab nav */}
        <div className="flex gap-1 bg-white border border-[#E8E5DF] rounded-2xl p-1.5 mb-6 w-fit">
          {([
            { id: "courses", label: "Курсы",  icon: BookOpen,       count: courses.length },
            { id: "tests",   label: "Тесты",  icon: ClipboardList,  count: tests.length },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-[#0047FF] text-white shadow-sm shadow-[#0047FF]/20"
                  : "text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-[#F5F3EE]"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === tab.id ? "bg-white/25 text-white" : "bg-[#F0EEE9] text-[#6B6B6B]"
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── COURSES TAB ── */}
        {activeTab === "courses" && (
          <>
            {/* Search */}
            {courses.length > 0 && (
              <div className="relative mb-5">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A0A0] pointer-events-none" />
                <input
                  type="text"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  placeholder="Поиск по курсам..."
                  className="w-full pl-11 pr-10 py-3 rounded-xl bg-white border border-[#E8E5DF] text-sm text-[#1A1A1A] placeholder:text-[#A0A0A0] focus:outline-none focus:ring-2 focus:ring-[#0047FF]/20 focus:border-[#0047FF] transition-shadow"
                />
                {courseSearch && (
                  <button onClick={() => setCourseSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-[#F0EEE9] transition-colors">
                    <X className="w-4 h-4 text-[#8A8A8A]" />
                  </button>
                )}
              </div>
            )}

            {/* Courses grid */}
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-2 border-[#0047FF] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : courses.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                emoji="📚"
                title="Создайте первый курс"
                description="Поделитесь знаниями со студентами и начните зарабатывать"
                cta={{ label: "Создать курс", onClick: openCreate, icon: Plus }}
              />
            ) : filteredCourses.length === 0 ? (
              <EmptyState
                icon={Search}
                title="Ничего не найдено"
                description="Попробуйте изменить запрос поиска"
                cta={{ label: "Очистить поиск", onClick: () => setCourseSearch(""), icon: X }}
              />
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredCourses.map(course => {
                  const st = STATUS[course.status] || STATUS.pending;
                  const Icon = st.icon;
                  return (
                    <div key={course.id} className="group bg-white border border-[#E8E5DF] rounded-2xl overflow-hidden flex flex-col hover:border-[#0047FF]/30 hover:shadow-lg hover:shadow-[#0047FF]/5 transition-all duration-200">
                      {/* Thumbnail */}
                      <div className="aspect-video bg-[#F0EEE9] relative overflow-hidden">
                        {course.image ? (
                          <img src={course.image} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0047FF]/5 to-[#3366FF]/10">
                            <BookOpen className="w-10 h-10 text-[#0047FF]/30" />
                          </div>
                        )}
                        <div className={`absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border backdrop-blur-md bg-white/85 ${st.text} ${st.border}`}>
                          <Icon className="w-3 h-3" /> {st.label}
                        </div>
                      </div>

                      <div className="p-5 flex flex-col flex-1 gap-3">
                        <div>
                          <h3 className="text-[#0A0A0A] font-semibold leading-tight line-clamp-2 group-hover:text-[#0047FF] transition-colors">{course.title}</h3>
                          <div className="flex items-center justify-between gap-3 mt-2.5 text-xs">
                            <span className="flex items-center gap-1 text-[#6B6B6B]">
                              <Users className="w-3.5 h-3.5" />
                              {course.active_students || 0} {pluralStudents(course.active_students || 0)}
                            </span>
                            <span className={`font-semibold ${course.price === 0 ? "text-emerald-600" : "text-[#0047FF]"}`}>
                              {course.price === 0 ? "Бесплатно" : `${course.price.toLocaleString()} ₸`}
                            </span>
                          </div>
                        </div>

                        {course.pending_payments > 0 && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-[#0047FF]/5 border border-[#0047FF]/15 rounded-xl text-xs text-[#0047FF]">
                            <Coins className="w-3.5 h-3.5 shrink-0" />
                            {course.pending_payments} заявок ожидают оплаты
                          </div>
                        )}

                        {course.status === "rejected" && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            Отклонён — отредактируйте и отправьте снова
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 mt-auto pt-3 border-t border-[#F0EEE9]">
                          <Link to={`/instructor/courses/${course.id}/build`}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-[#0047FF] bg-[#0047FF]/5 hover:bg-[#0047FF]/10 border border-[#0047FF]/15 rounded-lg transition-colors font-medium">
                            <ListChecks className="w-3.5 h-3.5" /> Уроки
                          </Link>
                          <Link to={`/courses/${course.id}`}
                            className="flex items-center justify-center gap-1 py-2 px-3 text-xs text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-[#F0EEE9] border border-[#E8E5DF] rounded-lg transition-colors"
                            title="Посмотреть как студент">
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          <button onClick={() => openEdit(course)}
                            className="flex items-center justify-center gap-1 py-2 px-3 text-xs text-[#6B6B6B] hover:text-[#0047FF] hover:bg-[#0047FF]/5 border border-[#E8E5DF] rounded-lg transition-colors"
                            title="Редактировать">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {confirmDel === course.id ? (
                            <div className="flex gap-1">
                              <button onClick={() => handleDelete(course.id)} disabled={deleting === course.id}
                                className="px-2.5 py-2 text-xs bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-lg transition-colors font-medium">
                                {deleting === course.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Да"}
                              </button>
                              <button onClick={() => setConfirmDel(null)}
                                className="px-2.5 py-2 text-xs bg-[#F5F3EE] border border-[#E8E5DF] text-[#6B6B6B] rounded-lg hover:bg-[#F0EEE9]">
                                Нет
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDel(course.id)}
                              className="p-2 text-[#C0B8B0] hover:text-red-500 hover:bg-red-50 border border-[#E8E5DF] rounded-lg transition-colors"
                              title="Удалить">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── TESTS TAB ── */}
        {activeTab === "tests" && (
          <div>
            {/* Search */}
            {tests.length > 0 && (
              <div className="relative mb-5">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A0A0] pointer-events-none" />
                <input
                  type="text"
                  value={testSearch}
                  onChange={(e) => setTestSearch(e.target.value)}
                  placeholder="Поиск по тестам..."
                  className="w-full pl-11 pr-10 py-3 rounded-xl bg-white border border-[#E8E5DF] text-sm text-[#1A1A1A] placeholder:text-[#A0A0A0] focus:outline-none focus:ring-2 focus:ring-[#0047FF]/20 focus:border-[#0047FF] transition-shadow"
                />
                {testSearch && (
                  <button onClick={() => setTestSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-[#F0EEE9] transition-colors">
                    <X className="w-4 h-4 text-[#8A8A8A]" />
                  </button>
                )}
              </div>
            )}

            {testsLoading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-2 border-[#0047FF] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tests.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                emoji="📋"
                title="Создайте первый тест"
                description="Тесты — отдельные опросники для проверки знаний, доступные на странице /study"
                cta={{ label: "Создать тест", onClick: handleCreateTest, icon: Plus }}
              />
            ) : filteredTests.length === 0 ? (
              <EmptyState
                icon={Search}
                title="Ничего не найдено"
                description="Попробуйте изменить запрос поиска"
                cta={{ label: "Очистить поиск", onClick: () => setTestSearch(""), icon: X }}
              />
            ) : (
              <div className="space-y-2.5">
                {filteredTests.map(test => (
                  <div key={test.id} className="group bg-white border border-[#E8E5DF] rounded-2xl p-4 flex items-center gap-3 sm:gap-4 hover:border-[#0047FF]/30 hover:shadow-sm transition-all">
                    {/* Status indicator */}
                    <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                      test.status === "published"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}>
                      <FileText className="w-5 h-5" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <Link to={`/instructor/tests/${test.id}/build`} className="block">
                        <p className="text-[#0A0A0A] font-semibold text-sm truncate group-hover:text-[#0047FF] transition-colors">
                          {test.title || "Без названия"}
                        </p>
                      </Link>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[#8A8A8A] flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                          test.status === "published"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}>
                          {test.status === "published" ? "✓ Опубликован" : "○ Черновик"}
                        </span>
                        {test.question_count !== undefined && (
                          <span className="inline-flex items-center gap-1">
                            <Hash className="w-3 h-3" />{test.question_count} {pluralQuestions(test.question_count)}
                          </span>
                        )}
                        {test.category && <span className="text-[#A0A0A0]">· {test.category}</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Publish toggle */}
                      <button
                        onClick={() => handleToggleTestPublish(test)}
                        disabled={togglingTest === test.id}
                        title={test.status === "published" ? "Снять с публикации" : "Опубликовать"}
                        className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          test.status === "published"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                            : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                        }`}
                      >
                        {togglingTest === test.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : test.status === "published" ? (
                          <><Globe className="w-3.5 h-3.5" /> Активен</>
                        ) : (
                          <><EyeOff className="w-3.5 h-3.5" /> Скрыт</>
                        )}
                      </button>

                      {/* Mobile publish toggle (icon only) */}
                      <button
                        onClick={() => handleToggleTestPublish(test)}
                        disabled={togglingTest === test.id}
                        className={`sm:hidden p-2 rounded-lg border transition-colors ${
                          test.status === "published"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                        }`}
                      >
                        {togglingTest === test.id ? <Loader2 className="w-4 h-4 animate-spin" /> : test.status === "published" ? <Globe className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>

                      {/* Edit */}
                      <Link
                        to={`/instructor/tests/${test.id}/build`}
                        className="p-2 rounded-lg text-[#6B6B6B] hover:text-[#0047FF] hover:bg-[#0047FF]/5 border border-[#E8E5DF] transition-colors"
                        title="Редактировать вопросы"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>

                      {/* Delete */}
                      {confirmDelTest === test.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDeleteTest(test.id)}
                            disabled={deletingTest === test.id}
                            className="px-2.5 py-1.5 text-xs bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-lg transition-colors font-medium"
                          >
                            {deletingTest === test.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Да"}
                          </button>
                          <button onClick={() => setConfirmDelTest(null)}
                            className="px-2.5 py-1.5 text-xs bg-[#F5F3EE] border border-[#E8E5DF] text-[#6B6B6B] rounded-lg hover:bg-[#F0EEE9]">
                            Нет
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelTest(test.id)}
                          className="p-2 rounded-lg text-[#C0B8B0] hover:text-red-500 hover:bg-red-50 border border-[#E8E5DF] transition-colors"
                          title="Удалить тест"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL ── (light theme to match site) */}
      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="w-full sm:max-w-2xl bg-white border border-[#E8E5DF] rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/20 max-h-[92vh] flex flex-col">

              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EEE9] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0047FF]/10 flex items-center justify-center">
                    {modal === "edit" ? <Pencil className="w-4 h-4 text-[#0047FF]" /> : <Sparkles className="w-4 h-4 text-[#0047FF]" />}
                  </div>
                  <h2 className="text-[#0A0A0A] font-bold">
                    {modal === "edit" ? "Редактировать курс" : "Создать новый курс"}
                  </h2>
                </div>
                <button onClick={() => setModal(null)}
                  className="p-2 text-[#8A8A8A] hover:text-[#0A0A0A] transition-colors rounded-xl hover:bg-[#F0EEE9]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto flex-1 p-6 space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-[#3A3A3A] text-sm font-medium mb-2">
                    Название курса <span className="text-red-500">*</span>
                  </label>
                  <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="Например: React для начинающих"
                    className="w-full bg-white border border-[#E8E5DF] focus:border-[#0047FF] focus:ring-2 focus:ring-[#0047FF]/15 rounded-xl px-4 py-3 text-[#0A0A0A] placeholder-[#A0A0A0] outline-none transition-all" />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[#3A3A3A] text-sm font-medium mb-2">Описание</label>
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
                    placeholder="Чему научится студент, что будет делать..."
                    className="w-full bg-white border border-[#E8E5DF] focus:border-[#0047FF] focus:ring-2 focus:ring-[#0047FF]/15 rounded-xl px-4 py-3 text-[#0A0A0A] placeholder-[#A0A0A0] outline-none transition-all resize-none text-sm" />
                </div>

                {/* Program items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[#3A3A3A] text-sm font-medium flex items-center gap-1.5">
                      <ListChecks className="w-4 h-4 text-[#0047FF]" /> Программа курса
                    </label>
                    <span className="text-[#8A8A8A] text-xs">{programItems.filter(Boolean).length} шагов</span>
                  </div>
                  <div className="space-y-2">
                    {programItems.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-7 h-7 bg-[#0047FF]/10 border border-[#0047FF]/20 rounded-lg flex items-center justify-center text-[#0047FF] text-xs shrink-0 font-bold">
                          {i + 1}
                        </span>
                        <input value={item} onChange={e => updateItem(i, e.target.value)}
                          placeholder={`Шаг ${i + 1}... (можно добавить эмодзи 🚀)`}
                          className="flex-1 bg-white border border-[#E8E5DF] focus:border-[#0047FF] focus:ring-2 focus:ring-[#0047FF]/15 rounded-xl px-3 py-2.5 text-[#0A0A0A] placeholder-[#A0A0A0] outline-none transition-all text-sm" />
                        {programItems.length > 1 && (
                          <button onClick={() => removeItem(i)}
                            className="text-[#A0A0A0] hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button onClick={addProgramItem}
                      className="flex items-center gap-2 text-sm text-[#0047FF] hover:bg-[#0047FF]/5 transition-colors px-3 py-2 rounded-lg font-medium">
                      <Plus className="w-4 h-4" /> Добавить шаг
                    </button>
                  </div>
                </div>

                {/* Price + Duration */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#3A3A3A] text-sm font-medium mb-2">Цена (₸)</label>
                    <div className="relative">
                      <input type="number" min="0" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                        className="w-full bg-white border border-[#E8E5DF] focus:border-[#0047FF] focus:ring-2 focus:ring-[#0047FF]/15 rounded-xl px-4 py-3 text-[#0A0A0A] outline-none transition-all pr-12" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8A8A] text-sm font-medium">₸</span>
                    </div>
                    <p className="text-[#6B6B6B] text-xs mt-1.5">
                      {form.price === "0"
                        ? "🎁 Бесплатный курс"
                        : (
                          <>Студент заплатит <span className="font-semibold text-[#0A0A0A]">{Number(form.price).toLocaleString()} ₸</span>, вы получите <span className="font-semibold text-emerald-600">{Math.floor(Number(form.price) * 0.8).toLocaleString()} ₸</span></>
                        )
                      }
                    </p>
                  </div>
                  <div>
                    <label className="block text-[#3A3A3A] text-sm font-medium mb-2">Длительность</label>
                    <input value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))}
                      placeholder="напр. 10 часов, 3 недели"
                      className="w-full bg-white border border-[#E8E5DF] focus:border-[#0047FF] focus:ring-2 focus:ring-[#0047FF]/15 rounded-xl px-4 py-3 text-[#0A0A0A] placeholder-[#A0A0A0] outline-none transition-all" />
                  </div>
                </div>

                {/* Category + Level */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#3A3A3A] text-sm font-medium mb-2">Категория</label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map(c => (
                        <button key={c.value} type="button" onClick={() => setForm(p => ({ ...p, category: c.value }))}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                            form.category === c.value
                              ? "bg-[#0047FF] text-white border border-[#0047FF] shadow-sm shadow-[#0047FF]/20"
                              : "bg-white border border-[#E8E5DF] text-[#3A3A3A] hover:border-[#0047FF]/40"
                          }`}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#3A3A3A] text-sm font-medium mb-2">Уровень</label>
                    <div className="flex flex-col gap-2">
                      {LEVELS.map(l => (
                        <button key={l.value} type="button" onClick={() => setForm(p => ({ ...p, level: l.value }))}
                          className={`px-3 py-2 rounded-lg text-sm text-left transition-all ${
                            form.level === l.value
                              ? "bg-[#0047FF] text-white border border-[#0047FF] shadow-sm shadow-[#0047FF]/20"
                              : "bg-white border border-[#E8E5DF] text-[#3A3A3A] hover:border-[#0047FF]/40"
                          }`}>
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Image URL */}
                <div>
                  <label className="text-[#3A3A3A] text-sm font-medium mb-2 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-[#0047FF]" /> Обложка (URL картинки)
                  </label>
                  <input value={form.image} onChange={e => setForm(p => ({ ...p, image: e.target.value }))}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-white border border-[#E8E5DF] focus:border-[#0047FF] focus:ring-2 focus:ring-[#0047FF]/15 rounded-xl px-4 py-3 text-[#0A0A0A] placeholder-[#A0A0A0] outline-none transition-all text-sm" />
                  {form.image && (
                    <div className="mt-2 rounded-xl overflow-hidden aspect-video max-h-32 bg-[#F5F3EE] border border-[#E8E5DF]">
                      <img src={form.image} alt="preview" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = "none")} />
                    </div>
                  )}
                </div>

                {formError && (
                  <div className="flex items-center gap-2 text-red-700 text-sm p-3 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
                  </div>
                )}
                {modal === "edit" && (
                  <div className="flex items-start gap-2 text-amber-800 text-xs p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>После изменений курс снова уйдёт на проверку администратору</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-6 border-t border-[#F0EEE9] shrink-0">
                <button onClick={() => setModal(null)}
                  className="flex-1 py-3 bg-white border border-[#E8E5DF] text-[#3A3A3A] hover:bg-[#F0EEE9] rounded-xl text-sm font-medium transition-colors">
                  Отмена
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#0047FF] hover:bg-[#0038CC] active:scale-[0.98] disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all shadow-sm shadow-[#0047FF]/20">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : modal === "edit" ? "Сохранить изменения" : "Создать и отправить на проверку"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Reusable EmptyState component
   ────────────────────────────────────────────────────────────── */
function EmptyState({ icon: Icon, emoji, title, description, cta }: {
  icon: React.ComponentType<{ className?: string }>;
  emoji?: string;
  title: string;
  description: string;
  cta?: { label: string; onClick: () => void; icon: React.ComponentType<{ className?: string }> };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 bg-white border border-[#E8E5DF] rounded-2xl text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#0047FF]/8 flex items-center justify-center mb-5 relative">
        <Icon className="w-7 h-7 text-[#0047FF]" />
        {emoji && <span className="absolute -bottom-1 -right-1 text-2xl">{emoji}</span>}
      </div>
      <h2 className="text-lg font-bold text-[#0A0A0A] mb-1.5">{title}</h2>
      <p className="text-sm text-[#6B6B6B] max-w-md mb-5">{description}</p>
      {cta && (
        <button
          onClick={cta.onClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0047FF] hover:bg-[#0038CC] active:scale-[0.97] text-white rounded-xl text-sm font-medium transition-all shadow-sm shadow-[#0047FF]/20"
        >
          <cta.icon className="w-4 h-4" /> {cta.label}
        </button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Russian pluralization
   ────────────────────────────────────────────────────────────── */
function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}
const pluralCourses    = (n: number) => plural(n, ["курс", "курса", "курсов"]);
const pluralTests      = (n: number) => plural(n, ["тест", "теста", "тестов"]);
const pluralStudents   = (n: number) => plural(n, ["студент", "студента", "студентов"]);
const pluralQuestions  = (n: number) => plural(n, ["вопрос", "вопроса", "вопросов"]);

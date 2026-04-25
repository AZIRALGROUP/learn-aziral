import { useState, useEffect } from "react";
import { usePageTitle } from "../hooks/usePageTitle";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  GraduationCap, Plus, Pencil, Trash2, CheckCircle2, Clock, XCircle,
  BookOpen, TrendingUp, Users, Loader2, X, AlertCircle, Eye,
  ListChecks, Image as ImageIcon, ArrowRight,
  CreditCard, Copy, CheckCheck, Banknote, ShieldCheck
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

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

const STATUS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:  { label: "На проверке", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: Clock },
  approved: { label: "Опубликован", color: "text-green-400 bg-green-500/10 border-green-500/20", icon: CheckCircle2 },
  rejected: { label: "Отклонён",    color: "text-red-400 bg-red-500/10 border-red-500/20",         icon: XCircle },
};

const EMPTY = { title: "", description: "", content: "", price: "0", category: "web", level: "beginner", duration: "", image: "" };
const PAYMENT_PHONE = import.meta.env.VITE_PAYMENT_PHONE || "+7 707 994 94 69";

export function InstructorPage() {
  usePageTitle("Кабинет инструктора — AZIRAL");
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

  // Apply flow
  const [applyLoading, setApplyLoading]   = useState(true);
  const [applyStatus, setApplyStatus]     = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [applying, setApplying]           = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [copied, setCopied]               = useState(false);
  const [applyForm, setApplyForm]         = useState({ bio: "", experience: "", team_name: "" });

  const isInstructor = user?.role === "instructor";
  const JSON_HEADERS = { "Content-Type": "application/json" } as const;

  useEffect(() => {
    if (!user) return;
    if (isInstructor) loadData();
    else checkApply();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, eRes] = await Promise.all([
        fetch("/api/instructor/courses", { credentials: 'include' }),
        fetch("/api/instructor/earnings", { credentials: 'include' }),
      ]);
      if (cRes.ok) setCourses(await cRes.json());
      if (eRes.ok) setEarnings(await eRes.json());
    } finally {
      setLoading(false);
    }
  };

  const checkApply = async () => {
    setApplyLoading(true);
    try {
      const r = await fetch("/api/instructor/apply", { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        setApplyStatus(d?.status || null);
        setPaymentStatus(d?.payment_status || null);
      }
    } finally {
      setApplyLoading(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const r = await fetch("/api/instructor/apply", {
        method: "POST", credentials: 'include',
        headers: JSON_HEADERS, body: JSON.stringify(applyForm),
      });
      if (r.ok) {
        const d = await r.json();
        setApplyStatus(d.status);
        setPaymentStatus(d.payment_status);
      }
    } finally {
      setApplying(false);
    }
  };

  const handlePaymentSent = async () => {
    setConfirmingPayment(true);
    try {
      const r = await fetch("/api/instructor/apply/payment", { method: "POST", credentials: 'include' });
      if (r.ok) setPaymentStatus("sent");
    } finally {
      setConfirmingPayment(false);
    }
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
    try {
      const content = JSON.stringify(programItems.filter(Boolean));
      const body = { ...form, price: Number(form.price), content };
      const url = modal === "edit" ? `/api/courses/${editId}` : "/api/courses";
      const method = modal === "edit" ? "PATCH" : "POST";
      const r = await fetch(url, { method, credentials: 'include', headers: JSON_HEADERS, body: JSON.stringify(body) });
      if (r.ok) { setModal(null); loadData(); }
      else { const d = await r.json().catch(() => ({})); setFormError((d as { error?: string }).error || "Ошибка сохранения"); }
    } catch {
      setFormError("Ошибка сети — попробуйте ещё раз");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      const r = await fetch(`/api/courses/${id}`, { method: "DELETE", credentials: 'include' });
      if (r.ok) {
        setConfirmDel(null);
        loadData();
      } else {
        setFormError("Не удалось удалить курс — попробуйте снова");
      }
    } catch {
      setFormError("Ошибка сети при удалении");
    } finally {
      setDeleting(null);
    }
  };

  const addProgramItem = () => setProgramItems(p => [...p, ""]);
  const updateItem = (i: number, val: string) => setProgramItems(p => p.map((x, j) => j === i ? val : x));
  const removeItem = (i: number) => setProgramItems(p => p.filter((_, j) => j !== i));

  // ── NOT LOGGED IN ──
  if (!user) return (
    <div className="min-h-screen bg-[#F5F3EE] flex flex-col items-center justify-center pt-24 gap-4">
      <GraduationCap className="w-12 h-12 text-[#A0A0A0]" />
      <p className="text-[#6B6B6B] text-lg">Нужно войти в аккаунт</p>
      <Link to="/login" className="px-5 py-2.5 bg-[#0047FF] hover:bg-[#0038CC] text-white rounded-xl text-sm transition-colors">Войти</Link>
    </div>
  );

  // ── APPLY PAGE ──
  if (!isInstructor) return (
    <div className="min-h-screen bg-[#F5F3EE] pt-24 pb-20">
      <div className="max-w-2xl mx-auto px-6">

        {/* Header */}
        <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="text-center mb-10">
          <div className="w-20 h-20 bg-[#0047FF] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-black/8">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl text-[#0A0A0A] font-bold mb-3">Стать инструктором</h1>
          <p className="text-[#6B6B6B] text-lg">Создавайте курсы и зарабатывайте{" "}
            <span className="text-[#0047FF] font-semibold">80% от каждой продажи</span>
          </p>
        </motion.div>

        {/* Benefits */}
        <motion.div transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3 mb-8">
          {[["80%","Ваш доход"], ["5 000₸","Разовый взнос"], ["∞","Курсов без лимита"]].map(([v, l]) => (
            <div key={l} className="text-center p-4 bg-[#F5F3EE] border border-[#E8E5DF] rounded-2xl">
              <p className="text-2xl font-bold text-[#0A0A0A] mb-1">{v}</p>
              <p className="text-[#6B6B6B] text-xs">{l}</p>
            </div>
          ))}
        </motion.div>

        {/* Progress steps */}
        {!applyLoading && applyStatus !== "rejected" && (
          <motion.div transition={{ delay: 0.05 }}
            className="flex items-center gap-0 mb-8">
            {[
              { label: "Заявка", done: !!applyStatus },
              { label: "Оплата", done: paymentStatus === "sent" || paymentStatus === "confirmed" },
              { label: "Проверка", done: paymentStatus === "confirmed" },
              { label: "Готово",  done: applyStatus === "approved" },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    step.done ? "bg-[#0047FF] border-[#0047FF] text-white" : "bg-transparent border-[#E8E5DF] text-[#8A8A8A]"
                  }`}>
                    {step.done ? <CheckCheck className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={`text-xs mt-1 ${step.done ? "text-[#0047FF]" : "text-[#8A8A8A]"}`}>{step.label}</span>
                </div>
                {i < arr.length - 1 && <div className={`h-px flex-1 mb-4 mx-1 transition-all ${step.done ? "bg-[#0047FF]/50" : "bg-[#EDEAE4]"}`} />}
              </div>
            ))}
          </motion.div>
        )}

        {applyLoading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-[#0047FF] border-t-transparent rounded-full animate-spin" /></div>

        ) : applyStatus === "rejected" ? (
          /* ── REJECTED ── */
          <motion.div
            className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 text-center space-y-4">
            <XCircle className="w-10 h-10 text-red-400 mx-auto" />
            <div>
              <h2 className="text-[#0A0A0A] text-xl mb-2">Заявка отклонена</h2>
              <p className="text-[#6B6B6B] text-sm">Напишите нам на{" "}
                <a href="mailto:aziralgroup@outlook.com" className="text-[#0047FF] hover:underline">aziralgroup@outlook.com</a>{" "}
                для уточнения деталей.
              </p>
            </div>
            <button onClick={() => { setApplyStatus(null); setPaymentStatus(null); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#F5F3EE] border border-[#E8E5DF] text-[#3A3A3A] hover:text-[#0A0A0A] rounded-xl text-sm transition-colors">
              <ArrowRight className="w-4 h-4" /> Подать повторно
            </button>
          </motion.div>

        ) : !applyStatus ? (
          /* ── STEP 1: FORM ── */
          <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.15 }}
            className="bg-[#F5F3EE] border border-[#E8E5DF] rounded-2xl p-8 space-y-5">
            <div className="flex items-center gap-2 p-3 bg-[#0047FF]/5 border border-[#0047FF]/15 rounded-xl">
              <Banknote className="w-4 h-4 text-[#0047FF] shrink-0" />
              <p className="text-[#0047FF] text-sm">После заполнения формы вам нужно будет оплатить взнос <span className="font-semibold text-[#0047FF]">5 000 ₸</span> через Kaspi</p>
            </div>
            <div>
              <label className="block text-[#6B6B6B] text-sm mb-2">Название команды / бренда</label>
              <input value={applyForm.team_name} onChange={e => setApplyForm(p => ({ ...p, team_name: e.target.value }))}
                placeholder="Например: DevAcademy, Code Team KZ..."
                className="w-full bg-[#F5F3EE] border border-[#E8E5DF] focus:border-[#0047FF]/50 rounded-xl px-4 py-3 text-[#0A0A0A] placeholder-[#A0A0A0] outline-none transition-colors text-sm" />
            </div>
            <div>
              <label className="block text-[#6B6B6B] text-sm mb-2">О себе</label>
              <textarea value={applyForm.bio} onChange={e => setApplyForm(p => ({ ...p, bio: e.target.value }))} rows={3}
                placeholder="Расскажите кто вы и чем занимаетесь..."
                className="w-full bg-[#F5F3EE] border border-[#E8E5DF] focus:border-[#0047FF]/50 rounded-xl px-4 py-3 text-[#0A0A0A] placeholder-[#A0A0A0] outline-none transition-colors resize-none text-sm" />
            </div>
            <div>
              <label className="block text-[#6B6B6B] text-sm mb-2">Какие курсы хотите создавать</label>
              <textarea value={applyForm.experience} onChange={e => setApplyForm(p => ({ ...p, experience: e.target.value }))} rows={3}
                placeholder="Опишите тематику курсов, ваш опыт в этой сфере..."
                className="w-full bg-[#F5F3EE] border border-[#E8E5DF] focus:border-[#0047FF]/50 rounded-xl px-4 py-3 text-[#0A0A0A] placeholder-[#A0A0A0] outline-none transition-colors resize-none text-sm" />
            </div>
            <button onClick={handleApply} disabled={applying || !applyForm.bio.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#0047FF] hover:bg-[#0038CC] disabled:opacity-50 text-white rounded-xl font-medium transition-all hover:scale-[1.01]">
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Продолжить к оплате</>}
            </button>
          </motion.div>

        ) : paymentStatus === "awaiting" ? (
          /* ── STEP 2: PAYMENT ── */
          <motion.div initial={{ y: 20 }} animate={{ y: 0 }}
            className="space-y-4">
            {/* Amount */}
            <div className="bg-[#F5F3EE] border border-[#0047FF]/20 rounded-2xl p-6 text-center">
              <CreditCard className="w-10 h-10 text-[#0047FF] mx-auto mb-3" />
              <p className="text-[#6B6B6B] text-sm mb-1">К оплате</p>
              <p className="text-4xl font-bold text-[#0A0A0A] mb-1">5 000 <span className="text-[#0047FF]">₸</span></p>
              <p className="text-[#6B6B6B] text-sm">Разовый взнос за доступ к платформе инструктора</p>
            </div>

            {/* Kaspi pay details */}
            <div className="bg-[#F5F3EE] border border-[#E8E5DF] rounded-2xl p-6 space-y-4">
              <h3 className="text-[#0A0A0A] font-semibold flex items-center gap-2">
                <span className="w-6 h-6 bg-red-500 rounded-lg flex items-center justify-center text-[#0A0A0A] text-xs font-bold">K</span>
                Оплата через Kaspi
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#F5F3EE] border border-[#E8E5DF] rounded-xl">
                  <div>
                    <p className="text-[#6B6B6B] text-xs mb-0.5">Номер телефона</p>
                    <p className="text-[#0A0A0A] font-mono font-medium">{PAYMENT_PHONE}</p>
                  </div>
                  <button onClick={copyKaspi}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0047FF]/10 border border-[#0047FF]/30 text-[#0047FF] hover:bg-[#0047FF]/30 rounded-lg text-xs transition-all">
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

                <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                  <p className="text-amber-400 text-xs flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    В комментарии к переводу укажите ваш email: <span className="font-medium text-amber-700">{user.email}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Confirm button */}
            <button onClick={handlePaymentSent} disabled={confirmingPayment}
              className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 text-white rounded-2xl font-semibold text-lg transition-all hover:scale-[1.01] shadow-lg shadow-green-900/20">
              {confirmingPayment ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Я оплатил — уведомить администратора</>}
            </button>
            <p className="text-center text-[#8A8A8A] text-xs">Нажмите кнопку только после того, как отправили перевод</p>
          </motion.div>

        ) : paymentStatus === "sent" ? (
          /* ── STEP 3: AWAITING PAYMENT CONFIRMATION ── */
          <motion.div
            className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-8 text-center space-y-3">
            <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <CreditCard className="w-7 h-7 text-blue-400" />
            </div>
            <h2 className="text-[#0A0A0A] text-xl">Оплата проверяется</h2>
            <p className="text-[#6B6B6B] text-sm">Администратор проверяет ваш платёж. Обычно это занимает до нескольких часов. Вы получите уведомление в личном кабинете.</p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-blue-400 text-sm">Ожидаем подтверждения</span>
            </div>
          </motion.div>

        ) : paymentStatus === "confirmed" ? (
          /* ── STEP 4: APPLICATION REVIEW ── */
          <motion.div
            className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-8 text-center space-y-3">
            <div className="w-14 h-14 bg-yellow-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7 text-yellow-400" />
            </div>
            <h2 className="text-[#0A0A0A] text-xl">Заявка на рассмотрении</h2>
            <p className="text-[#6B6B6B] text-sm">Оплата подтверждена ✓ Теперь администратор рассматривает вашу заявку. Обычно это занимает до 24 часов.</p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <span className="text-yellow-400 text-sm">Рассматривается</span>
            </div>
          </motion.div>

        ) : null}
      </div>
    </div>
  );

  // ── DASHBOARD ──
  return (
    <div className="min-h-screen bg-[#F5F3EE] pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl text-[#0A0A0A] font-bold">Кабинет инструктора</h1>
            <p className="text-[#6B6B6B] text-sm mt-1">Добро пожаловать, {user.name} 👋</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0047FF] hover:bg-[#0038CC] text-white text-sm rounded-xl transition-all hover:scale-105 shadow-lg shadow-black/8">
            <Plus className="w-4 h-4" /> Новый курс
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Курсов",      value: courses.length, icon: BookOpen,    gradient: "from-[#0047FF] to-[#0038CC]" },
            { label: "Студентов",   value: courses.reduce((a, c) => a + (c.active_students || 0), 0), icon: Users, gradient: "from-[#0047FF] to-[#0038CC]" },
            { label: "Заработано",  value: `${earnings.net.toLocaleString()} ₸`, icon: TrendingUp, gradient: "from-green-600 to-green-700" },
            { label: "Ожид. оплат", value: courses.reduce((a, c) => a + (c.pending_payments || 0), 0), icon: Clock, gradient: "from-yellow-600 to-yellow-700" },
          ].map(s => (
            <div key={s.label} className="bg-[#F5F3EE] border border-[#E8E5DF] rounded-2xl p-5">
              <div className={`w-9 h-9 bg-gradient-to-br ${s.gradient} rounded-xl flex items-center justify-center mb-3 shadow-lg`}>
                <s.icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-xl font-bold text-[#0A0A0A]">{s.value}</p>
              <p className="text-[#6B6B6B] text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Revenue banner */}
        {earnings.gross > 0 && (
          <div className="bg-[#F0F9F0] border border-green-200 rounded-2xl p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-[#0A0A0A] text-sm font-medium">Общий доход с продаж</p>
                <p className="text-[#6B6B6B] text-xs">Оборот: {earnings.gross.toLocaleString()} ₸</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="text-center">
                <p className="text-green-400 font-bold text-lg">{earnings.net.toLocaleString()} ₸</p>
                <p className="text-[#8A8A8A] text-xs">Ваши 80%</p>
              </div>
              <div className="text-center">
                <p className="text-[#6B6B6B] font-bold text-lg">{earnings.platform.toLocaleString()} ₸</p>
                <p className="text-[#8A8A8A] text-xs">Платформа 20%</p>
              </div>
            </div>
          </div>
        )}

        {/* Courses grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#0047FF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20 bg-white/[0.02] border border-[#E8E5DF] rounded-2xl">
            <div className="text-5xl mb-4">📚</div>
            <p className="text-[#0A0A0A] text-xl mb-2">Создайте первый курс</p>
            <p className="text-[#6B6B6B] mb-6">Поделитесь знаниями и начните зарабатывать</p>
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0047FF] hover:bg-[#0038CC] text-white rounded-xl text-sm transition-colors">
              <Plus className="w-4 h-4" /> Создать курс
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map(course => {
              const st = STATUS[course.status] || STATUS.pending;
              const Icon = st.icon;
              return (
                <div key={course.id} className="bg-[#F5F3EE] border border-[#E8E5DF] rounded-2xl overflow-hidden flex flex-col">
                  {/* Thumbnail */}
                  <div className="aspect-video bg-[#F0EEE9] relative overflow-hidden">
                    {course.image
                      ? <img src={course.image} alt={course.title} className="w-full h-full object-cover opacity-70" />
                      : <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-8 h-8 text-blue-400/20" /></div>
                    }
                    <div className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-lg text-xs border backdrop-blur-sm ${st.color}`}>
                      <Icon className="w-3 h-3" /> {st.label}
                    </div>
                  </div>

                  <div className="p-5 flex flex-col flex-1 gap-3">
                    <div>
                      <h3 className="text-[#0A0A0A] font-semibold leading-tight line-clamp-2">{course.title}</h3>
                      <div className="flex items-center gap-3 mt-2 text-xs text-[#6B6B6B]">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{course.active_students || 0} студентов</span>
                        <span className={course.price === 0 ? "text-green-400" : "text-[#0047FF]"}>
                          {course.price === 0 ? "Бесплатно" : `${course.price.toLocaleString()} ₸`}
                        </span>
                      </div>
                    </div>

                    {course.pending_payments > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/5 border border-yellow-500/15 rounded-xl text-xs text-yellow-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {course.pending_payments} заявок ожидают оплаты
                      </div>
                    )}

                    {course.status === "rejected" && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/5 border border-red-500/15 rounded-xl text-xs text-red-400">
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        Курс отклонён — отредактируйте и отправьте снова
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-auto pt-2 border-t border-[#E8E5DF]">
                      <Link to={`/instructor/courses/${course.id}/build`}
                        className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-[#0047FF] bg-[#0047FF]/5 hover:bg-[#0038CC]/10 border border-[#0047FF]/20 rounded-lg transition-colors font-medium">
                        <BookOpen className="w-3.5 h-3.5" /> Уроки
                      </Link>
                      <Link to={`/courses/${course.id}`}
                        className="flex items-center justify-center gap-1 py-2 px-3 text-xs text-[#6B6B6B] hover:text-[#0A0A0A] border border-[#E8E5DF] hover:border-[#E8E5DF] rounded-lg transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                      <button onClick={() => openEdit(course)}
                        className="flex items-center justify-center gap-1 py-2 px-3 text-xs text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {confirmDel === course.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleDelete(course.id)} disabled={deleting === course.id}
                            className="px-2.5 py-2 text-xs bg-red-600/20 border border-red-600/30 text-red-400 hover:bg-red-600/30 rounded-lg transition-colors">
                            {deleting === course.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Да"}
                          </button>
                          <button onClick={() => setConfirmDel(null)}
                            className="px-2.5 py-2 text-xs bg-[#F5F3EE] border border-[#E8E5DF] text-[#6B6B6B] rounded-lg">
                            Нет
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDel(course.id)}
                          className="p-2 text-red-400/50 hover:text-red-400 border border-red-500/10 hover:border-red-500/30 rounded-lg transition-colors">
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
      </div>

      {/* ── MODAL ── */}
      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="w-full sm:max-w-2xl bg-[#0d1117] border border-[#E8E5DF] rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col">

              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
                <h2 className="text-white font-semibold">
                  {modal === "edit" ? "✏️ Редактировать курс" : "✨ Создать курс"}
                </h2>
                <button onClick={() => setModal(null)}
                  className="p-2 text-[#9CA3AF] hover:text-white transition-colors rounded-xl hover:bg-white/5">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto flex-1 p-6 space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-[#9CA3AF] text-sm mb-2">Название курса *</label>
                  <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="Например: React для начинающих"
                    className="w-full bg-white/5 border border-white/10 focus:border-[#0047FF]/50 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none transition-colors" />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[#9CA3AF] text-sm mb-2">Описание</label>
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
                    placeholder="Чему научится студент, что будет делать..."
                    className="w-full bg-white/5 border border-white/10 focus:border-[#0047FF]/50 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none transition-colors resize-none text-sm" />
                </div>

                {/* Program items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[#9CA3AF] text-sm flex items-center gap-1.5">
                      <ListChecks className="w-4 h-4" /> Программа курса
                    </label>
                    <span className="text-[#9CA3AF] text-xs">{programItems.filter(Boolean).length} шагов</span>
                  </div>
                  <div className="space-y-2">
                    {programItems.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-[#0047FF]/20 border border-[#0047FF]/30 rounded-lg flex items-center justify-center text-[#0047FF] text-xs shrink-0 font-medium">
                          {i + 1}
                        </span>
                        <input value={item} onChange={e => updateItem(i, e.target.value)}
                          placeholder={`Шаг ${i + 1}... (можно добавить эмодзи в начало 🚀)`}
                          className="flex-1 bg-white/5 border border-white/10 focus:border-[#0047FF]/50 rounded-xl px-3 py-2.5 text-white placeholder-white/30 outline-none transition-colors text-sm" />
                        {programItems.length > 1 && (
                          <button onClick={() => removeItem(i)} className="text-[#9CA3AF] hover:text-red-400 transition-colors p-1">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button onClick={addProgramItem}
                      className="flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-[#0047FF] transition-colors px-2 py-1.5">
                      <Plus className="w-4 h-4" /> Добавить шаг
                    </button>
                  </div>
                </div>

                {/* Price + Duration */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#9CA3AF] text-sm mb-2">Цена (₸)</label>
                    <div className="relative">
                      <input type="number" min="0" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 focus:border-[#0047FF]/50 rounded-xl px-4 py-3 text-white outline-none transition-colors pr-12" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-sm">₸</span>
                    </div>
                    <p className="text-[#9CA3AF] text-xs mt-1">{form.price === "0" ? "🎁 Бесплатный курс" : `Студент заплатит ${Number(form.price).toLocaleString()} ₸, вы получите ${Math.floor(Number(form.price) * 0.8).toLocaleString()} ₸`}</p>
                  </div>
                  <div>
                    <label className="block text-[#9CA3AF] text-sm mb-2">Длительность</label>
                    <input value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))}
                      placeholder="напр. 10 часов, 3 недели"
                      className="w-full bg-white/5 border border-white/10 focus:border-[#0047FF]/50 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none transition-colors" />
                  </div>
                </div>

                {/* Category + Level */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#9CA3AF] text-sm mb-2">Категория</label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map(c => (
                        <button key={c.value} type="button" onClick={() => setForm(p => ({ ...p, category: c.value }))}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-all ${form.category === c.value ? "bg-[#0047FF] text-white border border-[#0038CC]" : "bg-white/5 border border-white/10 text-[#9CA3AF] hover:border-white/20 hover:text-white"}`}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#9CA3AF] text-sm mb-2">Уровень</label>
                    <div className="flex flex-col gap-2">
                      {LEVELS.map(l => (
                        <button key={l.value} type="button" onClick={() => setForm(p => ({ ...p, level: l.value }))}
                          className={`px-3 py-2 rounded-lg text-sm text-left transition-all ${form.level === l.value ? "bg-[#0047FF] text-white border border-[#0038CC]" : "bg-white/5 border border-white/10 text-[#9CA3AF] hover:border-white/20 hover:text-white"}`}>
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Image URL */}
                <div>
                  <label className="block text-[#9CA3AF] text-sm mb-2 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4" /> Обложка (URL картинки)
                  </label>
                  <input value={form.image} onChange={e => setForm(p => ({ ...p, image: e.target.value }))}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-white/5 border border-white/10 focus:border-[#0047FF]/50 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none transition-colors text-sm" />
                  {form.image && (
                    <div className="mt-2 rounded-xl overflow-hidden aspect-video max-h-32 bg-white/5">
                      <img src={form.image} alt="preview" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = "none")} />
                    </div>
                  )}
                </div>

                {formError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
                  </div>
                )}
                {modal === "edit" && (
                  <div className="flex items-center gap-2 text-yellow-400/70 text-xs p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-xl">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    После изменений курс снова уйдёт на проверку администратору
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-6 border-t border-white/10 shrink-0">
                <button onClick={() => setModal(null)}
                  className="flex-1 py-3 bg-white/5 border border-white/10 text-[#9CA3AF] hover:text-white rounded-xl text-sm transition-colors">
                  Отмена
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#0047FF] hover:bg-[#0038CC] disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all">
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

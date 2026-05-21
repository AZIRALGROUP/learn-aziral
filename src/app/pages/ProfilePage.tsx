import { useState, useEffect, useRef } from "react";
import { usePageTitle } from "../hooks/usePageTitle";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  User, Clock, CheckCircle2, AlertCircle, XCircle,
  LogOut, Settings,
  Bell, BellOff, CheckCheck,
  BookOpen, GraduationCap, Zap, Play, CreditCard, ShieldCheck,
  Camera, AtSign, Check, X as XIcon, Loader2,
  ClipboardList, Plus, Pencil, Trash2, Globe, EyeOff, Hash, FileText, Sparkles, ArrowRight,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { authApi, testsApi } from "../../api/client";
import type { TestSummary } from "../../api/client";

type Notification = {
  id: number; lead_id: string | null; type: string;
  message: string; read: number; created_at: string;
};

const NOTIF_ICONS: Record<string, { color: string; icon: typeof AlertCircle }> = {
  new:         { color: "text-blue-400",   icon: AlertCircle },
  in_progress: { color: "text-yellow-400", icon: Clock },
  done:        { color: "text-green-400",  icon: CheckCircle2 },
  rejected:    { color: "text-red-400",    icon: XCircle },
};

export function ProfilePage() {
  usePageTitle("Личный кабинет — AZIRAL");
  const { user, logout, refetch } = useAuth();
  const { t } = useTranslation();

  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"notifications" | "settings" | "courses" | "tests">("tests");

  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [userXp, setUserXp] = useState(0);
  const [instructorApp, setInstructorApp] = useState<any>(null);

  // My tests (создание доступно всем залогиненным)
  const [myTests, setMyTests] = useState<TestSummary[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [creatingTest, setCreatingTest] = useState(false);
  const [confirmDelTest, setConfirmDelTest] = useState<number | null>(null);
  const [deletingTest, setDeletingTest] = useState<number | null>(null);
  const [togglingTest, setTogglingTest] = useState<number | null>(null);

  // Settings
  const [notifEnabled, setNotifEnabled] = useState((user as any)?.notifications_enabled !== 0);
  const [settForm, setSettForm] = useState({
    name: user?.name || "",
    username: user?.username || "",
    bio: user?.bio || "",
    currentPassword: "",
    newPassword: "",
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null);
  const [avatarData, setAvatarData] = useState<string | null | undefined>(undefined);
  const [settLoading, setSettLoading] = useState(false);
  const [settMsg, setSettMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [unCheck, setUnCheck] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");
  const unCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync when user loads
  useEffect(() => {
    if (user) {
      setNotifEnabled(user.notifications_enabled !== 0);
      setSettForm(p => ({ ...p, name: user.name, username: user.username || "", bio: user.bio || "" }));
      setAvatarPreview(user.avatar || null);
    }
  }, [user]);

  /** Crop + resize to 256×256 JPEG */
  const processAvatar = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = ev => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 256; canvas.height = 256;
          const ctx = canvas.getContext("2d")!;
          const min = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, 256, 256);
          resolve(canvas.toDataURL("image/jpeg", 0.88));
        };
        img.src = ev.target!.result as string;
      };
      reader.readAsDataURL(file);
    });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const data = await processAvatar(file);
      setAvatarPreview(data);
      setAvatarData(data);
    } catch { /* ignore */ }
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setAvatarData(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /** Debounced username check */
  const handleUsernameChange = (val: string) => {
    setSettForm(p => ({ ...p, username: val }));
    if (unCheckTimer.current) clearTimeout(unCheckTimer.current);
    const clean = val.trim().toLowerCase();
    if (!clean || clean === (user?.username || "")) { setUnCheck("idle"); return; }
    if (!/^[a-z0-9_]{3,30}$/.test(clean)) { setUnCheck("invalid"); return; }
    setUnCheck("checking");
    unCheckTimer.current = setTimeout(async () => {
      try {
        const d = await authApi.checkUsername(clean);
        setUnCheck(d.available ? "ok" : "taken");
      } catch { setUnCheck("idle"); }
    }, 500);
  };


  const creds = { credentials: 'include' as const };

  // Load user's tests
  const loadTests = async () => {
    setTestsLoading(true);
    try {
      const data = await testsApi.myTests();
      setMyTests(data);
    } catch { /* ignore */ }
    finally { setTestsLoading(false); }
  };

  const handleCreateTest = async () => {
    if (creatingTest) return;
    setCreatingTest(true);
    try {
      const t = await testsApi.create({ title: "Новый тест" });
      navigate(`/instructor/tests/${t.id}/build`);
    } catch { setCreatingTest(false); }
  };

  const handleDeleteTest = async (id: number) => {
    setDeletingTest(id);
    try {
      await testsApi.delete(id);
      setMyTests(prev => prev.filter(t => t.id !== id));
      setConfirmDelTest(null);
    } finally { setDeletingTest(null); }
  };

  const handleToggleTestPublish = async (test: TestSummary) => {
    setTogglingTest(test.id);
    try {
      const res = await testsApi.togglePublish(test.id);
      setMyTests(prev => prev.map(t => t.id === test.id ? { ...t, status: res.status } : t));
    } finally { setTogglingTest(null); }
  };

  useEffect(() => {
    if (!user) return;
    loadTests();
    Promise.all([
      fetch("/api/profile/notifications", creds).then(r => r.ok ? r.json() : []),
      fetch("/api/profile/courses", creds).then(r => r.ok ? r.json() : []).then(setMyCourses),
      fetch("/api/profile/xp", creds).then(r => r.ok ? r.json() : { xp: 0 }).then(d => setUserXp(d.xp)),
      fetch("/api/instructor/apply", creds).then(r => r.ok ? r.json() : null).then(setInstructorApp),
    ]).then(([n]) => {
      const notifs: Notification[] = Array.isArray(n) ? n : [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(x => !x.read).length);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  const markRead = async (id: number) => {
    await fetch(`/api/profile/notifications/${id}/read`, { method: "PATCH", credentials: 'include' });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await fetch("/api/profile/notifications/read-all", { method: "PATCH", credentials: 'include' });
    setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
    setUnreadCount(0);
  };

  const handleSettSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettMsg(null);
    if (unCheck === "taken") { setSettMsg({ type: "err", text: "Никнейм уже занят" }); return; }
    if (unCheck === "invalid") { setSettMsg({ type: "err", text: "Никнейм: 3–30 символов, только a-z, 0-9 и _" }); return; }
    setSettLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: settForm.name,
        bio: settForm.bio.trim() || null,
        notifications_enabled: notifEnabled,
      };
      const cleanUN = settForm.username.trim().toLowerCase();
      if (cleanUN !== (user?.username || "")) body.username = cleanUN || null;
      if (avatarData !== undefined) body.avatar = avatarData;
      if (settForm.newPassword) {
        body.currentPassword = settForm.currentPassword;
        body.newPassword = settForm.newPassword;
      }
      const data = await authApi.updateMe(body);
      if ((data as any).user) {
        // update local user state via refetch
        await refetch();
      }
      setSettMsg({ type: "ok", text: "Профиль обновлён ✓" });
      setSettForm(p => ({ ...p, currentPassword: "", newPassword: "" }));
      setAvatarData(undefined);
      setUnCheck("idle");
    } catch (err: any) {
      setSettMsg({ type: "err", text: err.message });
    } finally {
      setSettLoading(false);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleString("ru-RU", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-[#F5F3EE] pt-24 pb-16 px-4 lg:px-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-lg shadow-black/10">
              {user?.avatar
                ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-[#0047FF] flex items-center justify-center text-white text-xl font-bold">{user?.name?.[0]?.toUpperCase()}</div>
              }
            </div>
            <div>
              <h1 className="text-[#0A0A0A] text-xl font-medium">{user?.name}</h1>
              {user?.username
                ? <p className="text-[#0047FF] text-sm font-medium">@{user.username}</p>
                : <p className="text-[#6B6B6B] text-sm">{user?.email}</p>
              }
              {user?.bio && <p className="text-[#6B6B6B] text-sm mt-0.5 max-w-xs leading-snug">{user.bio}</p>}
              {userXp > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mt-1.5 w-fit">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-yellow-600 text-sm font-semibold">{userXp} XP</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={logout} className="flex items-center gap-2 px-4 py-2.5 bg-[#F5F3EE] border border-[#E8E5DF] rounded-xl text-[#6B6B6B] hover:text-[#0A0A0A] text-sm transition-colors">
              <LogOut className="w-4 h-4" /> {t("nav.logout")}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Тестов",   value: myTests.length, icon: ClipboardList, color: "text-purple-600",  bg: "bg-purple-500/10" },
            { label: "Курсов",   value: myCourses.length, icon: GraduationCap, color: "text-[#0047FF]", bg: "bg-[#0047FF]/10" },
            { label: "Завершено", value: myCourses.filter(c => c.completed_lessons === c.total_lessons && c.total_lessons > 0).length, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-500/10" },
            { label: "XP",       value: userXp, icon: Zap, color: "text-amber-600", bg: "bg-amber-500/10" },
          ].map(s => (
            <div key={s.label} className="bg-[#F5F3EE] border border-[#E8E5DF] rounded-2xl p-4 lg:p-5">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className="text-[#0A0A0A] text-2xl lg:text-3xl font-bold leading-tight">{s.value}</div>
              <span className="text-[#6B6B6B] text-xs mt-0.5 block">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setTab("tests")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all ${tab === "tests" ? "bg-[#0047FF] text-white" : "bg-[#F5F3EE] border border-[#E8E5DF] text-[#6B6B6B] hover:text-[#0A0A0A]"}`}
          >
            <ClipboardList className="w-4 h-4" /> Мои тесты
            {myTests.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === "tests" ? "bg-white/25 text-white" : "bg-[#E8E5DF] text-[#3A3A3A]"}`}>{myTests.length}</span>}
          </button>
          <button
            onClick={() => setTab("courses")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all ${tab === "courses" ? "bg-[#0047FF] text-white" : "bg-[#F5F3EE] border border-[#E8E5DF] text-[#6B6B6B] hover:text-[#0A0A0A]"}`}
          >
            <GraduationCap className="w-4 h-4" /> Мои курсы
            {myCourses.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === "courses" ? "bg-white/25 text-white" : "bg-[#E8E5DF] text-[#3A3A3A]"}`}>{myCourses.length}</span>}
          </button>
          <button
            onClick={() => { setTab("notifications"); }}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all ${tab === "notifications" ? "bg-[#0047FF] text-white" : "bg-[#F5F3EE] border border-[#E8E5DF] text-[#6B6B6B] hover:text-[#0A0A0A]"}`}
          >
            <Bell className="w-4 h-4" />
            Уведомления
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("settings")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all ${tab === "settings" ? "bg-[#0047FF] text-white" : "bg-[#F5F3EE] border border-[#E8E5DF] text-[#6B6B6B] hover:text-[#0A0A0A]"}`}
          >
            <Settings className="w-4 h-4" /> {t("profile.settings")}
          </button>
        </div>

        {/* Tests tab */}
        {tab === "tests" && (
          <div className="space-y-3">
            {/* Header with create */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div>
                <h2 className="text-lg font-bold text-[#0A0A0A]">Мои тесты</h2>
                <p className="text-xs text-[#6B6B6B] mt-0.5">Создавайте тесты бесплатно — для учёбы или для друзей</p>
              </div>
              <button
                onClick={handleCreateTest}
                disabled={creatingTest}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0047FF] hover:bg-[#0038CC] active:scale-[0.97] disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-all shadow-sm shadow-[#0047FF]/20 shrink-0"
              >
                {creatingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Создать тест
              </button>
            </div>

            {testsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-7 h-7 border-2 border-[#0047FF] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : myTests.length === 0 ? (
              /* Empty state */
              <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-600 to-[#0047FF] rounded-2xl p-6 sm:p-8 text-white">
                <div className="absolute top-0 right-0 w-56 h-56 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-pink-400/20 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl pointer-events-none" />
                <div className="relative">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full border border-white/20 mb-3">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Бесплатно</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold mb-2 leading-tight">У вас пока нет тестов ✏️</h3>
                  <p className="text-white/85 text-sm mb-5 max-w-md">
                    Создайте свой первый тест за 2 минуты — добавьте вопросы или используйте AI-генерацию из темы.
                  </p>
                  <button
                    onClick={handleCreateTest}
                    disabled={creatingTest}
                    className="group inline-flex items-center gap-2 px-5 py-3 bg-white text-purple-700 hover:bg-purple-50 active:scale-[0.98] disabled:opacity-60 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-black/10"
                  >
                    {creatingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Создать первый тест
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            ) : (
              /* Tests list */
              <div className="space-y-2.5">
                {myTests.map(test => (
                  <div key={test.id} className="group bg-white border border-[#E8E5DF] rounded-2xl p-3 sm:p-4 flex items-center gap-3 hover:border-[#0047FF]/30 hover:shadow-sm transition-all">
                    <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                      test.status === "published" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                    }`}>
                      <FileText className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <Link to={`/instructor/tests/${test.id}/build`} className="block">
                        <p className="text-[#0A0A0A] font-semibold text-sm truncate group-hover:text-[#0047FF] transition-colors">
                          {test.title || "Без названия"}
                        </p>
                      </Link>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[#8A8A8A] flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                          test.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          {test.status === "published" ? "✓ Опубликован" : "○ Черновик"}
                        </span>
                        {test.question_count !== undefined && (
                          <span className="inline-flex items-center gap-1">
                            <Hash className="w-3 h-3" />{test.question_count}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleToggleTestPublish(test)}
                        disabled={togglingTest === test.id}
                        title={test.status === "published" ? "Снять с публикации" : "Опубликовать"}
                        className={`p-2 rounded-lg border transition-colors ${
                          test.status === "published"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                            : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                        }`}
                      >
                        {togglingTest === test.id ? <Loader2 className="w-4 h-4 animate-spin" /> : test.status === "published" ? <Globe className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>

                      <Link
                        to={`/instructor/tests/${test.id}/build`}
                        className="p-2 rounded-lg text-[#6B6B6B] hover:text-[#0047FF] hover:bg-[#0047FF]/5 border border-[#E8E5DF] transition-colors"
                        title="Редактировать"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>

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
                            className="px-2.5 py-1.5 text-xs bg-[#F5F3EE] border border-[#E8E5DF] text-[#6B6B6B] rounded-lg hover:bg-[#F0EEE9]">Нет</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelTest(test.id)}
                          className="p-2 rounded-lg text-[#C0B8B0] hover:text-red-500 hover:bg-red-50 border border-[#E8E5DF] transition-colors"
                          title="Удалить"
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

        {/* Notifications tab */}
        {tab === "notifications" && (
          <div>
            {/* Header with mark all read */}
            {notifications.length > 0 && unreadCount > 0 && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-2 px-4 py-2 bg-[#F5F3EE] border border-[#E8E5DF] rounded-xl text-[#6B6B6B] hover:text-[#0A0A0A] text-sm transition-colors"
                >
                  <CheckCheck className="w-4 h-4" /> Прочитать всё
                </button>
              </div>
            )}

            {loading && <div className="text-center py-16 text-[#6B6B6B]">Загрузка...</div>}
            {!loading && notifications.length === 0 && (
              <div className="text-center py-16 bg-white/[0.02] rounded-2xl border border-[#E8E5DF]">
                <Bell className="w-12 h-12 text-[#A0A0A0] mx-auto mb-4" />
                <p className="text-[#6B6B6B]">У вас пока нет уведомлений</p>
              </div>
            )}

            <div className="space-y-3">
              {notifications.map(n => {
                const ni = NOTIF_ICONS[n.type] ?? { color: "text-[#6B6B6B]", icon: Bell };
                const Icon = ni.icon;
                return (
                  <motion.div
                    key={n.id}
                    initial={{ y: 8 }}
                    animate={{ y: 0 }}
                    className={`relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-200 ${
                      n.read ? "bg-white/[0.02] border-[#E8E5DF]" : "bg-blue-500/5 border-blue-500/20"
                    }`}
                  >
                    {/* Unread dot */}
                    {!n.read && (
                      <span className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                    <div className={`mt-0.5 p-2 rounded-xl border ${n.read ? "bg-[#F5F3EE] border-[#E8E5DF]" : "bg-blue-500/10 border-blue-500/20"} shrink-0`}>
                      <Icon className={`w-4 h-4 ${ni.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-relaxed ${n.read ? "text-[#6B6B6B]" : "text-gray-200"}`}>{n.message}</p>
                      <p className="text-[#8A8A8A] text-xs mt-1">{fmt(n.created_at)}</p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="shrink-0 mt-0.5 text-xs text-blue-400 hover:text-[#0047FF] transition-colors"
                      >
                        Прочитано
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Courses tab */}
        {tab === "courses" && (
          <div className="space-y-4">
            {/* Instructor application status */}
            {!loading && instructorApp && (
              <motion.div initial={{ y: 10 }} animate={{ y: 0 }}
                className="bg-[#F5F3EE] border border-[#0047FF]/20 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-[#E8E5DF] bg-[#0047FF]/5">
                  <GraduationCap className="w-4 h-4 text-[#0047FF]" />
                  <span className="text-[#0047FF] text-sm font-medium">Заявка на инструктора</span>
                  <span className="text-[#8A8A8A] text-xs ml-auto">{fmt(instructorApp.created_at)}</span>
                </div>
                <div className="p-5 flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#6B6B6B]" />
                    <span className="text-[#6B6B6B] text-sm">Взнос 5 000 ₸:</span>
                    {instructorApp.payment_status === "awaiting" && <span className="px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs rounded-lg">⏳ Ожидает оплаты</span>}
                    {instructorApp.payment_status === "sent" && <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs rounded-lg">🔍 Проверяется</span>}
                    {instructorApp.payment_status === "confirmed" && <span className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-lg">✅ Подтверждена</span>}
                    {instructorApp.payment_status === "rejected" && <span className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">❌ Отклонена</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#6B6B6B]" />
                    <span className="text-[#6B6B6B] text-sm">Заявка:</span>
                    {instructorApp.status === "approved" && <span className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-lg">🎉 Одобрена</span>}
                    {instructorApp.status === "rejected" && <span className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">❌ Отклонена</span>}
                    {instructorApp.status === "pending" && <span className="px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs rounded-lg">⏳ На рассмотрении</span>}
                  </div>
                  {instructorApp.status === "approved" && (
                    <Link to="/instructor" className="ml-auto text-xs text-[#0047FF] font-medium hover:underline">
                      Кабинет инструктора →
                    </Link>
                  )}
                </div>
              </motion.div>
            )}

            {myCourses.length === 0 ? (
              <div className="text-center py-16 bg-white/[0.02] rounded-2xl border border-[#E8E5DF]">
                <GraduationCap className="w-12 h-12 text-[#A0A0A0] mx-auto mb-4" />
                <p className="text-[#6B6B6B] mb-4">Вы ещё не записаны ни на один курс</p>
                <Link to="/courses" className="px-5 py-2.5 bg-[#0047FF] text-white rounded-xl text-sm">
                  Смотреть курсы
                </Link>
              </div>
            ) : myCourses.map((course: any) => {
              const pct = course.total_lessons > 0 ? Math.round(course.completed_lessons / course.total_lessons * 100) : 0;
              const isComplete = pct === 100;
              return (
                <motion.div key={course.id} initial={{ y: 10 }} animate={{ y: 0 }}
                  className="bg-[#F5F3EE] border border-[#E8E5DF] rounded-2xl overflow-hidden hover:border-white/[0.12] transition-all">
                  <div className="flex gap-4 p-4">
                    <div className="w-20 h-16 rounded-xl overflow-hidden bg-[#F0EEE9] shrink-0">
                      {course.image
                        ? <img src={course.image} alt={course.title} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-6 h-6 text-blue-400/30" /></div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[#0A0A0A] font-medium text-sm leading-snug line-clamp-1">{course.title}</h3>
                      <p className="text-[#6B6B6B] text-xs mt-0.5">{course.instructor_name}</p>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-[#8A8A8A] mb-1">
                          <span>{course.completed_lessons}/{course.total_lessons} уроков</span>
                          <span className={isComplete ? "text-green-400" : "text-[#0047FF]"}>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-[#F5F3EE] rounded-full">
                          <div className={`h-1.5 rounded-full transition-all duration-500 ${isComplete ? "bg-green-500" : "bg-[#0047FF]"}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-4 flex items-center justify-between">
                    <div className="text-xs text-[#8A8A8A]">
                      {course.payment_status === 'pending' && <span className="text-yellow-500">⏳ Ожидает оплаты</span>}
                      {course.payment_status !== 'pending' && isComplete && <span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Завершён</span>}
                      {course.payment_status !== 'pending' && !isComplete && course.total_lessons > 0 && <span>Продолжайте учиться!</span>}
                    </div>
                    {course.total_lessons > 0 && course.payment_status !== 'pending' ? (
                      <Link to={`/courses/${course.id}/learn${course.next_lesson_id ? `/${course.next_lesson_id}` : ''}`}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#0047FF]/10 border border-[#0047FF]/30 hover:bg-[#0047FF]/30 text-[#0047FF] hover:text-[#0038CC] rounded-xl text-xs font-medium transition-all">
                        <Play className="w-3.5 h-3.5" /> {isComplete ? "Повторить" : pct === 0 ? "Начать" : "Продолжить"}
                      </Link>
                    ) : (
                      <Link to={`/courses/${course.id}`} className="text-xs text-[#6B6B6B] hover:text-[#0A0A0A] transition-colors">Подробнее →</Link>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Settings tab */}
        {tab === "settings" && (
          <form onSubmit={handleSettSubmit} className="space-y-4 max-w-lg">

            {settMsg && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                className={`px-4 py-3 rounded-xl text-sm border ${settMsg.type === "ok" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600"}`}>
                {settMsg.text}
              </motion.div>
            )}

            {/* ── Avatar ── */}
            <div className="bg-white border border-[#E8E5DF] rounded-2xl p-6">
              <p className="text-[#0A0A0A] font-medium text-sm mb-4">Фото профиля</p>
              <div className="flex items-center gap-5">
                <div className="relative shrink-0 group">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#E8E5DF]">
                    {avatarPreview
                      ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-[#0047FF] flex items-center justify-center text-white text-2xl font-bold">{user?.name?.[0]?.toUpperCase()}</div>
                    }
                  </div>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="w-5 h-5 text-white" />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-[#0047FF] hover:bg-[#0038CC] text-white text-sm rounded-xl transition-colors">
                    Загрузить фото
                  </button>
                  {avatarPreview && (
                    <button type="button" onClick={handleRemoveAvatar}
                      className="px-4 py-2 bg-[#F5F3EE] border border-[#E8E5DF] text-[#6B6B6B] hover:text-red-600 hover:border-red-200 text-sm rounded-xl transition-colors">
                      Удалить фото
                    </button>
                  )}
                  <p className="text-[11px] text-[#B0ADA8]">JPG, PNG, GIF · до 10 МБ · обрезается до квадрата 256×256</p>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            {/* ── Identity ── */}
            <div className="bg-white border border-[#E8E5DF] rounded-2xl p-6 space-y-4">
              <p className="text-[#0A0A0A] font-medium text-sm">Профиль</p>

              <div>
                <label className="block text-[#6B6B6B] text-xs font-medium mb-1.5">Отображаемое имя</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C0BDB8]" />
                  <input value={settForm.name} onChange={e => setSettForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Иван Иванов"
                    className="w-full bg-[#F8F7F4] border border-[#E8E5DF] focus:border-[#0047FF] rounded-xl pl-10 pr-4 py-3 text-[#0A0A0A] outline-none transition-colors text-sm" />
                </div>
                <p className="mt-1 text-[11px] text-[#B0ADA8]">Видно всем. Может быть любым.</p>
              </div>

              <div>
                <label className="block text-[#6B6B6B] text-xs font-medium mb-1.5">Никнейм</label>
                <div className="relative">
                  <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C0BDB8]" />
                  <input value={settForm.username} onChange={e => handleUsernameChange(e.target.value)}
                    placeholder="username" autoComplete="username"
                    className={`w-full bg-[#F8F7F4] border rounded-xl pl-10 pr-10 py-3 text-[#0A0A0A] outline-none transition-colors text-sm ${
                      unCheck === "taken" || unCheck === "invalid" ? "border-red-400 focus:border-red-400"
                      : unCheck === "ok" ? "border-green-400 focus:border-green-400"
                      : "border-[#E8E5DF] focus:border-[#0047FF]"
                    }`} />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    {unCheck === "checking" && <Loader2 className="w-4 h-4 text-[#B0ADA8] animate-spin" />}
                    {unCheck === "ok" && <Check className="w-4 h-4 text-green-500" />}
                    {(unCheck === "taken" || unCheck === "invalid") && <XIcon className="w-4 h-4 text-red-500" />}
                  </div>
                </div>
                <p className={`mt-1 text-[11px] ${unCheck === "ok" ? "text-green-600" : unCheck === "taken" || unCheck === "invalid" ? "text-red-500" : "text-[#B0ADA8]"}`}>
                  {unCheck === "ok" ? "Никнейм свободен ✓"
                    : unCheck === "taken" ? "Никнейм занят — выберите другой"
                    : unCheck === "invalid" ? "3–30 символов, только a-z, 0-9 и _"
                    : "3–30 символов · a-z, 0-9, _ · Для входа вместо email"}
                </p>
              </div>

              <div>
                <label className="block text-[#6B6B6B] text-xs font-medium mb-1.5">О себе</label>
                <textarea value={settForm.bio} onChange={e => setSettForm(p => ({ ...p, bio: e.target.value.slice(0, 300) }))}
                  placeholder="Расскажите о себе пару слов..." rows={3}
                  className="w-full bg-[#F8F7F4] border border-[#E8E5DF] focus:border-[#0047FF] rounded-xl px-4 py-3 text-[#0A0A0A] placeholder-[#C0BDB8] outline-none transition-colors text-sm resize-none leading-relaxed" />
                <p className="mt-1 text-[11px] text-[#B0ADA8] text-right">{settForm.bio.length}/300</p>
              </div>
            </div>

            {/* ── Notifications ── */}
            <div className="bg-white border border-[#E8E5DF] rounded-2xl p-6">
              <p className="text-[#0A0A0A] font-medium text-sm mb-3">Уведомления</p>
              <button type="button" onClick={() => setNotifEnabled(v => !v)}
                className={`flex items-center justify-between w-full p-4 rounded-xl border transition-all duration-200 ${notifEnabled ? "bg-blue-50 border-blue-200" : "bg-[#F8F7F4] border-[#E8E5DF]"}`}>
                <div className="flex items-center gap-3">
                  {notifEnabled ? <Bell className="w-5 h-5 text-[#0047FF]" /> : <BellOff className="w-5 h-5 text-[#6B6B6B]" />}
                  <div className="text-left">
                    <div className={`text-sm font-medium ${notifEnabled ? "text-[#0A0A0A]" : "text-[#6B6B6B]"}`}>Email-уведомления</div>
                    <div className="text-xs text-[#6B6B6B]">{notifEnabled ? "Вы получаете письма при изменении статуса" : "Письма отключены"}</div>
                  </div>
                </div>
                <div className={`relative w-12 h-6 rounded-full transition-colors duration-200 overflow-hidden shrink-0 ${notifEnabled ? "bg-[#0047FF]" : "bg-[#EDEAE4]"}`}>
                  <span className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${notifEnabled ? "translate-x-6" : "translate-x-0"}`} />
                </div>
              </button>
            </div>

            {/* ── Password ── */}
            <div className="bg-white border border-[#E8E5DF] rounded-2xl p-6 space-y-3">
              <p className="text-[#0A0A0A] font-medium text-sm">Изменить пароль</p>
              <input type="password" value={settForm.currentPassword} onChange={e => setSettForm(p => ({ ...p, currentPassword: e.target.value }))} placeholder={t("profile.current_password")} className="w-full bg-[#F8F7F4] border border-[#E8E5DF] focus:border-[#0047FF] rounded-xl px-4 py-3 text-[#0A0A0A] placeholder-[#C0BDB8] outline-none transition-colors text-sm" />
              <input type="password" value={settForm.newPassword} onChange={e => setSettForm(p => ({ ...p, newPassword: e.target.value }))} placeholder={t("profile.new_password")} className="w-full bg-[#F8F7F4] border border-[#E8E5DF] focus:border-[#0047FF] rounded-xl px-4 py-3 text-[#0A0A0A] placeholder-[#C0BDB8] outline-none transition-colors text-sm" />
            </div>

            <button type="submit"
              disabled={settLoading || unCheck === "checking" || unCheck === "taken" || unCheck === "invalid"}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#0047FF] hover:bg-[#0038CC] disabled:opacity-60 text-white rounded-xl font-medium transition-colors duration-200">
              {settLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Сохраняем...</> : "Сохранить изменения"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

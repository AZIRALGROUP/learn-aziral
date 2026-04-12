import { useState, useEffect } from "react";
import { usePageTitle } from "../hooks/usePageTitle";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  User, Clock, CheckCircle2, AlertCircle, XCircle,
  LogOut, Settings,
  Bell, BellOff, CheckCheck,
  BookOpen, GraduationCap, Zap, Play, CreditCard, ShieldCheck
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";

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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"notifications" | "settings" | "courses">("courses");

  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [userXp, setUserXp] = useState(0);
  const [instructorApp, setInstructorApp] = useState<any>(null);

  // Settings
  const [notifEnabled, setNotifEnabled] = useState(
    (user as any)?.notifications_enabled !== 0
  );
  const [settForm, setSettForm] = useState({ name: user?.name || "", currentPassword: "", newPassword: "" });
  const [settLoading, setSettLoading] = useState(false);
  const [settMsg, setSettMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Sync toggle state when user loads asynchronously (auth/me response)
  useEffect(() => {
    if (user) {
      setNotifEnabled((user as any).notifications_enabled !== 0);
      setSettForm(p => ({ ...p, name: user.name }));
    }
  }, [user]);


  const creds = { credentials: 'include' as const };

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch("/api/profile/notifications", creds).then(r => r.json()),
      fetch("/api/profile/courses", creds).then(r => r.ok ? r.json() : []).then(setMyCourses),
      fetch("/api/profile/xp", creds).then(r => r.ok ? r.json() : { xp: 0 }).then(d => setUserXp(d.xp)),
      fetch("/api/instructor/apply", creds).then(r => r.ok ? r.json() : null).then(setInstructorApp),
    ]).then(([n]) => {
      const notifs: Notification[] = Array.isArray(n) ? n : [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(x => !x.read).length);
    }).finally(() => setLoading(false));
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
    setSettLoading(true);
    try {
      const r = await fetch("/api/auth/me", {
        method: "PATCH",
        credentials: 'include', headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settForm, notifications_enabled: notifEnabled }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setSettMsg({ type: "ok", text: t("profile.data_updated") });
      setSettForm(p => ({ ...p, currentPassword: "", newPassword: "" }));
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
            <div className="w-14 h-14 bg-gradient-to-br [#0047FF] rounded-2xl flex items-center justify-center text-[#0A0A0A] text-xl font-bold shadow-lg shadow-black/10">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-[#0A0A0A] text-xl font-medium">{user?.name}</h1>
              <p className="text-[#6B6B6B] text-sm">{user?.email}</p>
              {userXp > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mt-1">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-yellow-600 text-sm font-semibold">{userXp} XP</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { logout(); navigate("/"); }} className="flex items-center gap-2 px-4 py-2.5 bg-[#F5F3EE] border border-[#E8E5DF] rounded-xl text-[#6B6B6B] hover:text-[#0A0A0A] text-sm transition-colors">
              <LogOut className="w-4 h-4" /> {t("nav.logout")}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Курсов куплено",  value: myCourses.length,                                                   icon: GraduationCap, color: "text-blue-400" },
            { label: "Завершено",       value: myCourses.filter(c => c.completed_lessons === c.total_lessons && c.total_lessons > 0).length, icon: CheckCircle2,  color: "text-green-400" },
            { label: "XP",              value: userXp,                                                             icon: Zap,           color: "text-yellow-400" },
          ].map(s => (
            <div key={s.label} className="bg-[#F5F3EE] border border-[#E8E5DF] rounded-2xl p-4 lg:p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#6B6B6B] text-xs lg:text-sm">{s.label}</span>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className="text-[#0A0A0A] text-2xl lg:text-3xl">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => { setTab("notifications"); }}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all ${tab === "notifications" ? "bg-[#0047FF] text-white" : "bg-[#F5F3EE] border border-[#E8E5DF] text-[#6B6B6B] hover:text-[#0A0A0A]"}`}
          >
            <Bell className="w-4 h-4" />
            Уведомления
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-[#0A0A0A] text-xs rounded-full flex items-center justify-center font-bold">
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
          <button
            onClick={() => setTab("courses")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all ${tab === "courses" ? "bg-[#0047FF] text-white" : "bg-[#F5F3EE] border border-[#E8E5DF] text-[#6B6B6B] hover:text-[#0A0A0A]"}`}
          >
            <GraduationCap className="w-4 h-4" /> Мои курсы
            {myCourses.length > 0 && <span className="bg-[#E8E5DF] text-[#0A0A0A] text-xs px-1.5 py-0.5 rounded-full">{myCourses.length}</span>}
          </button>
        </div>

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
                    <div className="w-20 h-16 rounded-xl overflow-hidden bg-gradient-to-br [#F0EEE9] shrink-0">
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
          <form onSubmit={handleSettSubmit} className="bg-[#F5F3EE] border border-[#E8E5DF] rounded-2xl p-6 space-y-5 max-w-lg">
            <h3 className="text-[#0A0A0A] mb-2">{t("profile.personal_data")}</h3>

            {settMsg && (
              <div className={`px-4 py-3 rounded-xl text-sm border ${settMsg.type === "ok" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                {settMsg.text}
              </div>
            )}

            <div>
              <label className="block text-[#6B6B6B] text-sm mb-2">{t("profile.name")}</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                <input
                  value={settForm.name}
                  onChange={e => setSettForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-[#F5F3EE] border border-[#E8E5DF] focus:border-[#0047FF]/50 rounded-xl pl-10 pr-4 py-3 text-[#0A0A0A] outline-none transition-colors"
                />
              </div>
            </div>

            {/* Notifications toggle */}
            <div className="pt-2">
              <label className="block text-[#6B6B6B] text-sm mb-3">Уведомления</label>
              <button
                type="button"
                onClick={() => setNotifEnabled(v => !v)}
                className={`flex items-center justify-between w-full p-4 rounded-xl border transition-all duration-200 ${
                  notifEnabled
                    ? "bg-blue-500/10 border-blue-500/30"
                    : "bg-[#F5F3EE] border-[#E8E5DF]"
                }`}
              >
                <div className="flex items-center gap-3">
                  {notifEnabled
                    ? <Bell className="w-5 h-5 text-blue-400" />
                    : <BellOff className="w-5 h-5 text-[#6B6B6B]" />}
                  <div className="text-left">
                    <div className={`text-sm font-medium ${notifEnabled ? "text-[#0A0A0A]" : "text-[#6B6B6B]"}`}>
                      Email-уведомления
                    </div>
                    <div className="text-xs text-[#6B6B6B]">
                      {notifEnabled ? "Вы получаете письма при изменении статуса" : "Письма отключены"}
                    </div>
                  </div>
                </div>
                {/* Toggle pill */}
                <div className={`relative w-12 h-6 rounded-full transition-colors duration-200 overflow-hidden shrink-0 ${notifEnabled ? "bg-blue-600" : "bg-[#EDEAE4]"}`}>
                  <span className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${notifEnabled ? "translate-x-6" : "translate-x-0"}`} />
                </div>
              </button>
            </div>

            <div className="pt-4 border-t border-[#E8E5DF]">
              <p className="text-[#6B6B6B] text-sm mb-4">Изменить пароль</p>
              <div className="space-y-3">
                <input type="password" value={settForm.currentPassword} onChange={e => setSettForm(p => ({ ...p, currentPassword: e.target.value }))} placeholder={t("profile.current_password")} className="w-full bg-[#F5F3EE] border border-[#E8E5DF] focus:border-[#0047FF]/50 rounded-xl px-4 py-3 text-[#0A0A0A] placeholder-[#A0A0A0] outline-none transition-colors" />
                <input type="password" value={settForm.newPassword} onChange={e => setSettForm(p => ({ ...p, newPassword: e.target.value }))} placeholder={t("profile.new_password")} className="w-full bg-[#F5F3EE] border border-[#E8E5DF] focus:border-[#0047FF]/50 rounded-xl px-4 py-3 text-[#0A0A0A] placeholder-[#A0A0A0] outline-none transition-colors" />
              </div>
            </div>

            <button type="submit" disabled={settLoading} className="px-6 py-3 bg-[#0047FF] text-white rounded-xl text-sm transition-all disabled:opacity-70">
              {settLoading ? t("profile.saving") : t("profile.save")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

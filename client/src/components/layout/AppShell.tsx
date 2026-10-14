"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { getSocket } from "@/lib/socket";
import api from "@/lib/api";
import {
  Sparkles,
  LayoutDashboard,
  GitFork,
  Activity,
  Boxes,
  Settings,
  LogOut,
  User,
  ShieldCheck,
  Bell,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  X,
  Check,
  ArrowRight,
  Clock,
  RefreshCw,
} from "lucide-react";

interface NotificationItem {
  _id: string;
  type: "SUCCESS" | "FAILURE" | "ESCALATION" | "SYSTEM";
  title: string;
  message: string;
  execution?: { _id: string; status: string; durationMs?: number } | string;
  workflow?: { _id: string; name: string } | string;
  read: boolean;
  createdAt: string;
}

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterUnread, setFilterUnread] = useState(false);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setIsLoadingNotifs(true);
    try {
      const res = await api.get<{
        success: boolean;
        notifications: NotificationItem[];
        unreadCount: number;
      }>("/notifications", {
        params: { unreadOnly: filterUnread },
      });
      if (res.data.success) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
      }
    } catch (err) {
      console.warn("Failed to fetch notifications:", err);
    } finally {
      setIsLoadingNotifs(false);
    }
  }, [filterUnread]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (isMounted) {
        await fetchNotifications();
      }
    })();

    // Socket.IO realtime notification listener
    const socket = getSocket();
    const onNewNotification = (notif: NotificationItem) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((c) => c + 1);
    };

    socket.on("new_notification", onNewNotification);

    return () => {
      isMounted = false;
      socket.off("new_notification", onNewNotification);
    };
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.patch<{ success: boolean; unreadCount: number }>(
        `/notifications/${id}/read`
      );
      if (res.data.success) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, read: true } : n))
        );
        setUnreadCount(res.data.unreadCount);
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await api.post<{ success: boolean; unreadCount: number }>(
        "/notifications/read-all"
      );
      if (res.data.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    if (!notif.read) {
      api.patch(`/notifications/${notif._id}/read`).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    const execId = typeof notif.execution === "object" ? notif.execution?._id : notif.execution;
    if (execId) {
      setIsDrawerOpen(false);
      router.push(`/executions/${execId}`);
    }
  };

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Workflows", href: "/workflows", icon: GitFork },
    { label: "Executions", href: "/executions", icon: Activity },
    { label: "Integrations", href: "/integrations", icon: Boxes },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "SUCCESS":
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case "FAILURE":
        return <AlertOctagon className="h-4 w-4 text-red-400" />;
      case "ESCALATION":
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      default:
        return <Sparkles className="h-4 w-4 text-indigo-400" />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Main Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 px-6 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 ring-1 ring-indigo-500/30 group-hover:scale-105 transition-transform">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black tracking-tight text-white group-hover:text-indigo-400 transition-colors">
                  Agentflow AI
                </span>
                <span className="text-[9px] font-mono tracking-widest text-zinc-400 uppercase -mt-0.5">
                  Autonomous Studio
                </span>
              </div>
            </Link>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-indigo-600/10 text-indigo-400 ring-1 ring-indigo-500/30"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${isActive ? "text-indigo-400" : "text-zinc-500"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Action Items */}
          <div className="flex items-center gap-3">
            {/* Notification Bell Button */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700 hover:text-white transition-all"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white shadow-lg shadow-indigo-600/40 animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* User Profile */}
            {user && (
              <div className="hidden sm:flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs">
                <User className="h-3.5 w-3.5 text-zinc-400" />
                <span className="font-semibold text-zinc-200">{user.name}</span>
                <span className="inline-flex items-center gap-1 rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400 border border-indigo-500/20">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  {user.role}
                </span>
              </div>
            )}

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs font-semibold text-zinc-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Slide-Over Notification Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
            <div className="w-screen max-w-md border-l border-zinc-800 bg-zinc-950 p-6 shadow-2xl flex flex-col justify-between">
              {/* Drawer Header */}
              <div>
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">Notifications Drawer</h3>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-indigo-600/20 px-2 py-0.5 text-[10px] font-mono font-bold text-indigo-400 border border-indigo-500/30">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Filter and Mark All Read Bar */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
                    <button
                      onClick={() => setFilterUnread(false)}
                      className={`rounded-md px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                        !filterUnread ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterUnread(true)}
                      className={`rounded-md px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                        filterUnread ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Unread
                    </button>
                  </div>

                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
              </div>

              {/* Notification List Scroll Area */}
              <div className="my-4 flex-1 overflow-y-auto space-y-3 pr-1">
                {isLoadingNotifs && notifications.length === 0 ? (
                  <div className="py-12 text-center text-xs text-zinc-400">
                    <RefreshCw className="mx-auto h-5 w-5 animate-spin text-indigo-400" />
                    <span className="mt-2 block">Loading notifications...</span>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-16 text-center text-xs text-zinc-500">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-zinc-600" />
                    <p className="mt-2 font-bold text-zinc-400">All caught up!</p>
                    <p className="text-[11px]">No notifications match your current filter.</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const execId = typeof n.execution === "object" ? n.execution?._id : n.execution;

                    return (
                      <div
                        key={n._id}
                        onClick={() => handleNotificationClick(n)}
                        className={`group relative rounded-xl border p-3.5 transition-all cursor-pointer ${
                          !n.read
                            ? "border-indigo-500/30 bg-indigo-950/20 hover:border-indigo-500/50"
                            : "border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5">{getNotificationIcon(n.type)}</div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">
                                  {n.title}
                                </h4>
                                {!n.read && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                                )}
                              </div>
                              <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{n.message}</p>
                            </div>
                          </div>

                          {!n.read && (
                            <button
                              onClick={(e) => handleMarkAsRead(n._id, e)}
                              title="Mark as read"
                              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-zinc-800/60 pt-2 text-[10px] text-zinc-400">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(n.createdAt).toLocaleTimeString()}
                          </span>

                          {execId && (
                            <span className="flex items-center gap-0.5 text-indigo-400 group-hover:translate-x-0.5 transition-transform font-semibold">
                              <span>View execution</span>
                              <ArrowRight className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Drawer Footer */}
              <div className="border-t border-zinc-800/80 pt-3 text-center text-[11px] text-zinc-400">
                <span>Autonomous Studio Notifications</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Body */}
      <main className="flex-1">{children}</main>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type AppNotification } from '../../lib/api';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = () =>
    api.notifications().then(({ items: list, unreadCount: count }) => {
      setItems(list);
      setUnreadCount(count);
    }).catch(() => {});

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const markRead = async (id: number) => {
    await api.markNotificationRead(id);
    await load();
  };

  const markAll = async () => {
    await api.markAllNotificationsRead();
    await load();
  };

  return (
    <div className="relative mb-4" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
      >
        <span>Notifications</span>
        {unreadCount > 0 && <span className="badge bg-amber-100 text-amber-800">{unreadCount}</span>}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-slate-200 bg-white shadow-lg max-h-80 overflow-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <span className="text-xs font-medium text-slate-500 uppercase">Inbox</span>
            {unreadCount > 0 && (
              <button type="button" className="text-xs text-teal hover:underline" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-slate-500 p-4">No notifications yet.</p>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={`px-3 py-3 border-b border-slate-50 last:border-0 ${n.read ? 'bg-white' : 'bg-teal/5'}`}
              >
                <div className="text-sm font-medium text-navy">{n.title}</div>
                <div className="text-xs text-slate-600 mt-0.5">{n.body}</div>
                <div className="flex items-center gap-3 mt-2">
                  {n.link && (
                    <Link
                      to={n.link}
                      className="text-xs text-teal hover:underline"
                      onClick={() => { markRead(n.id); setOpen(false); }}
                    >
                      Open
                    </Link>
                  )}
                  {!n.read && (
                    <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => markRead(n.id)}>
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

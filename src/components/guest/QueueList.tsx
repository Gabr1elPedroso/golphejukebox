import { useEffect, useState } from "react";
import { ListMusic } from "lucide-react";
import { QueueItem, subscribeToQueue } from "@/lib/queue";
import { Badge } from "@/components/ui/badge";

const QueueList = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const currentUser = localStorage.getItem("golphe_username") || "";

  useEffect(() => {
    const unsubscribe = subscribeToQueue(setQueue);
    return unsubscribe;
  }, []);

  if (queue.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <ListMusic className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="font-display text-sm">A fila está vazia</p>
        <p className="text-xs mt-1">Seja o primeiro a pedir uma música!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {queue.map((item, index) => {
        const isMine = item.requested_by.toLowerCase() === currentUser.toLowerCase();
        return (
          <div
            key={item.id}
            className={`elevated-card flex items-center gap-3 p-3 animate-slide-up transition-all ${
              isMine ? "ring-2 ring-accent" : ""
            }`}
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: "backwards" }}
          >
            <img
              src={item.album_cover_url}
              alt={item.title}
              className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-foreground truncate text-sm">
                {item.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">{item.artist}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-muted-foreground">
                  Pedido por: {item.requested_by}
                </span>
                {isMine && (
                  <Badge className="text-[10px] px-1.5 py-0 h-4 bg-accent text-accent-foreground border-0 font-display">
                    Sua música
                  </Badge>
                )}
              </div>
            </div>
            <span className="text-xs font-display font-bold text-muted-foreground/50 flex-shrink-0">
              #{index + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default QueueList;

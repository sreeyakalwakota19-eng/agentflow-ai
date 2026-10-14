import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/store/authStore";

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    const serverUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
      "http://localhost:5000";
    const token = useAuthStore.getState().token;

    socketInstance = io(serverUrl, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ["websocket", "polling"],
    });

    socketInstance.on("connect", () => {
      console.log("[Socket.IO] Connected to server:", socketInstance?.id);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("[Socket.IO] Disconnected from server:", reason);
    });

    socketInstance.on("connect_error", (err) => {
      console.warn("[Socket.IO] Connection error:", err.message);
    });
  }

  // Update auth token if it changed
  const currentToken = useAuthStore.getState().token;
  if (currentToken && socketInstance.auth && (socketInstance.auth as { token?: string }).token !== currentToken) {
    socketInstance.auth = { token: currentToken };
  }

  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

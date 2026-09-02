import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function connectSocket(accessToken: string): Socket {
  if (socket) {
    socket.auth = { token: accessToken };
    socket.disconnect().connect();
    return socket;
  }
  socket = io(import.meta.env.VITE_SOCKET_URL, {
    auth: { token: accessToken },
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}

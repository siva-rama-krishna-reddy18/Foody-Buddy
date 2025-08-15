import { io, Socket } from 'socket.io-client'

const URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'
export const socket: Socket = io(URL, {
  autoConnect: false,
})

export default socket
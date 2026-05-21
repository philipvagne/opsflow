import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from '../auth/auth.constants';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway {
  @WebSocketServer()
  server: Server;

  constructor(private jwtService: JwtService) {}

handleConnection(client: Socket) {
  try {
    const token = client.handshake.auth?.token;

    if (!token) {
      console.log('No token provided');
      client.disconnect();
      return;
    }

    const payload = this.jwtService.verify(token, {
      secret: jwtConstants.secret,
    });

    const userId = payload.sub;

    client.join(userId);

    console.log('SOCKET AUTH SUCCESS:', userId);
  } catch (err) {
    console.log('SOCKET AUTH FAILED:', err.message);
    client.disconnect();
  }
}

sendNotification(userId: string, payload: any) {
  console.log('EMITTING NOTIFICATION:', {
    userId,
    payload,
  });

  this.server.to(userId).emit('notification', payload);
}

emitTaskUpdated(userIds: string[], payload: any) {
  const uniqueUserIds = [...new Set(userIds)];
  console.log("task_updated EMIT:", payload);
  for (const userId of uniqueUserIds) {
    this.server.to(userId).emit("task_updated", payload);
  }
}

emitTaskUpdateCreated(userIds: string[], payload: any) {
  const uniqueUserIds = [...new Set(userIds)];

  for (const userId of uniqueUserIds) {
    this.server.to(userId).emit("task_update_created", payload);
  }
}
}

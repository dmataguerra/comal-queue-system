import { Inject } from '@nestjs/common';
import { type OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { StateService } from './state.service.js';
import type { Announcement } from './models/state.js';
import { allowedOrigins } from './origins.js';

@WebSocketGateway({ cors: { origin: allowedOrigins(), methods: ['GET', 'POST'] } })
export class EventsGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(@Inject(StateService) private readonly state: StateService) {}

  handleConnection(client: Socket): void {
    // A reconnect restores data, never repeats an old announcement or its audio.
    client.emit('state', this.state.snapshot());
  }

  broadcast(announcement?: Announcement): void {
    this.server?.emit('state', this.state.snapshot());
    if (announcement) this.server?.emit('announcement', announcement);
  }
}

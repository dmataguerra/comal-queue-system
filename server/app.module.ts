import { Module } from '@nestjs/common';
import { AppController, MediaController } from './app.controller.js';
import { LocalDatabase } from './database.js';
import { EventsGateway } from './events.gateway.js';
import { MediaService } from './media/media.service.js';
import { StateService } from './state.service.js';

@Module({
  controllers: [AppController, MediaController],
  providers: [LocalDatabase, MediaService, StateService, EventsGateway],
})
export class AppModule {}

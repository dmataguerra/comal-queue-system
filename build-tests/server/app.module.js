var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { AppController, MediaController } from './app.controller.js';
import { LocalDatabase } from './database.js';
import { EventsGateway } from './events.gateway.js';
import { MediaService } from './media/media.service.js';
import { StateService } from './state.service.js';
let AppModule = class AppModule {
};
AppModule = __decorate([
    Module({
        controllers: [AppController, MediaController],
        providers: [LocalDatabase, MediaService, StateService, EventsGateway],
    })
], AppModule);
export { AppModule };

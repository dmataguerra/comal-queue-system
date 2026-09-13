var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Put, Res } from '@nestjs/common';
import { StateService } from './state.service.js';
import { EventsGateway } from './events.gateway.js';
import { MediaService } from './media/media.service.js';
let AppController = class AppController {
    state;
    events;
    media;
    constructor(state, events, media) {
        this.state = state;
        this.events = events;
        this.media = media;
    }
    health() { return { ok: true, service: 'comal-local' }; }
    snapshot() { return this.state.snapshot(); }
    history() { return this.state.history(); }
    create(input) {
        const result = this.state.create(input);
        if (!result.replayed)
            this.events.broadcast(result.announcement);
        return result.turn;
    }
    announce(id, input) {
        const result = this.state.announce(id, input);
        if (!result.replayed)
            this.events.broadcast(result.announcement);
        return result.turn;
    }
    update(id, input) {
        const turn = this.state.update(id, input);
        this.events.broadcast();
        return turn;
    }
    multimedia(input) {
        const config = this.state.updateMultimedia(input);
        this.events.broadcast();
        return config;
    }
    settings(input) {
        const config = this.state.updateSettings(input);
        this.events.broadcast();
        return config;
    }
    refreshPlaylists() {
        const playlists = this.media.refresh();
        this.events.broadcast();
        return playlists;
    }
};
__decorate([
    Get('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "health", null);
__decorate([
    Get('state'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "snapshot", null);
__decorate([
    Get('history'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "history", null);
__decorate([
    Post('turns'),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "create", null);
__decorate([
    Post('turns/:id/announce'),
    HttpCode(200),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "announce", null);
__decorate([
    Patch('turns/:id'),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "update", null);
__decorate([
    Put('multimedia'),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "multimedia", null);
__decorate([
    Put('settings'),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "settings", null);
__decorate([
    Post('playlists/refresh'),
    HttpCode(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "refreshPlaylists", null);
AppController = __decorate([
    Controller('api'),
    __param(0, Inject(StateService)),
    __param(1, Inject(EventsGateway)),
    __param(2, Inject(MediaService)),
    __metadata("design:paramtypes", [StateService, EventsGateway, MediaService])
], AppController);
export { AppController };
let MediaController = class MediaController {
    media;
    constructor(media) {
        this.media = media;
    }
    file(genre, filename, response) {
        response.sendFile(this.media.file(genre, filename));
    }
};
__decorate([
    Get(':genre/:filename'),
    __param(0, Param('genre')),
    __param(1, Param('filename')),
    __param(2, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], MediaController.prototype, "file", null);
MediaController = __decorate([
    Controller('media'),
    __param(0, Inject(MediaService)),
    __metadata("design:paramtypes", [MediaService])
], MediaController);
export { MediaController };

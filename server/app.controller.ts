import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { StateService } from './state.service.js';
import { EventsGateway } from './events.gateway.js';
import { MediaService } from './media/media.service.js';

@Controller('api')
export class AppController {
  constructor(@Inject(StateService) private readonly state: StateService, @Inject(EventsGateway) private readonly events: EventsGateway, @Inject(MediaService) private readonly media: MediaService) {}

  @Get('health') health() { return { ok: true, service: 'comal-local' }; }
  @Get('state') snapshot() { return this.state.snapshot(); }
  @Get('history') history() { return this.state.history(); }

  @Post('turns') create(@Body() input: unknown) {
    const result = this.state.create(input);
    if (!result.replayed) this.events.broadcast(result.announcement);
    return result.turn;
  }

  @Post('turns/:id/announce')
  @HttpCode(200)
  announce(@Param('id') id: string, @Body() input: unknown) {
    const result = this.state.announce(id, input);
    if (!result.replayed) this.events.broadcast(result.announcement);
    return result.turn;
  }

  @Patch('turns/:id') update(@Param('id') id: string, @Body() input: unknown) {
    const turn = this.state.update(id, input);
    this.events.broadcast();
    return turn;
  }

  @Put('multimedia') multimedia(@Body() input: unknown) {
    const config = this.state.updateMultimedia(input);
    this.events.broadcast();
    return config;
  }

  @Put('settings') settings(@Body() input: unknown) {
    const config = this.state.updateSettings(input);
    this.events.broadcast();
    return config;
  }

  @Post('playlists/refresh')
  @HttpCode(200)
  refreshPlaylists() {
    const playlists = this.media.refresh();
    this.events.broadcast();
    return playlists;
  }
}

@Controller('media')
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Get(':genre/:filename') file(@Param('genre') genre: string, @Param('filename') filename: string, @Res() response: Response) {
    response.sendFile(this.media.file(genre, filename));
  }
}

import { Controller, Get, Inject, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import { RequireAny } from '../auth/access';
import { ExperienceMapService } from '../experience-map/map.service';
import { handle } from '../http/respond';

/** The experience map (docs/plans/13): pages, journeys, touchpoints, workflows, forms — connected. */
@Controller({ path: '/experience-map', scope: Scope.REQUEST })
export class ExperienceMapHandler {
  constructor(@Inject(ExperienceMapService) private readonly map: ExperienceMapService) { }

  @RequireAny('experience:read', 'workflows:read')
  @Get()
  get(@Res() ctx: Context) {
    return handle(ctx, () => this.map.map(), 'Failed to draw the map');
  }
}

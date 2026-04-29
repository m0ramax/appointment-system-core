import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { GenerateLinkDto } from './dto/generate-link.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ReviewsController {
  constructor(private service: ReviewsService) {}

  @Post('reviews/generate-link')
  @Roles('OWNER')
  generateLink(@Body() dto: GenerateLinkDto, @CurrentUser() user: any) {
    return this.service.generateLink(user.businessId, dto);
  }

  @Public()
  @Post('reviews/:token')
  submit(@Param('token') token: string, @Body() dto: SubmitReviewDto) {
    return this.service.submitReview(token, dto);
  }

  @Public()
  @Get('businesses/:slug/reviews')
  getBySlug(@Param('slug') slug: string) {
    return this.service.getBySlug(slug);
  }
}

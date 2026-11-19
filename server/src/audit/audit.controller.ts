import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SESSION_COOKIE } from '../auth/auth.constants.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Paginated } from '../common/types/api.js';
import { AuditQueryDto } from './audit-query.dto.js';
import type { AuditResponse } from './audit-response.js';
import { AuditService } from './audit.service.js';

@ApiTags('audit')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Nhật ký hoạt động của quán' })
  @ApiOkResponse({ description: 'Audit log có lọc và phân trang' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AuditQueryDto,
  ): Promise<Paginated<AuditResponse>> {
    return this.auditService.list(user.restaurantId, query);
  }
}

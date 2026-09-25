import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserEntity } from './user.entity';
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get('me') @ApiOkResponse({ type: UserEntity }) me(
    @CurrentUser() id: string,
  ) {
    return this.users.me(id);
  }
  @Patch('me') @ApiOkResponse({ type: UserEntity }) update(
    @CurrentUser() id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(id, dto);
  }
}

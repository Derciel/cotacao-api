import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @ApiOperation({ summary: 'Lista todos os usuários' })
    async findAll() {
        return this.usersService.findAll();
    }

    @Post()
    @ApiOperation({ summary: 'Cria um novo usuário' })
    async create(@Body() body: any) {
        return this.usersService.create(body);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Atualiza um usuário existente' })
    async update(@Param('id') id: string, @Body() body: any) {
        return this.usersService.update(+id, body);
    }
}

import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseInterceptors, UploadedFile, Query
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import {
  ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiQuery
} from '@nestjs/swagger';

@ApiTags('Clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) { }

  @Post()
  @ApiOperation({ summary: 'Cria um novo cliente manualmente' })
  @ApiResponse({ status: 201, description: 'O cliente foi criado com sucesso.' })
  create(@Body() createClientDto: CreateClientDto) {
    return this.clientsService.create(createClientDto);
  }

  @Get('cnpj/:cnpj')
  @ApiOperation({ summary: 'Busca dados cadastrais de um CNPJ via Brasil API' })
  @ApiResponse({ status: 200, description: 'Dados retornados com sucesso.' })
  @ApiResponse({ status: 404, description: 'CNPJ não encontrado.' })
  async getExternalCnpj(@Param('cnpj') cnpj: string) {
    // Nova funcionalidade integrada
    return await this.clientsService.findCnpjExternal(cnpj);
  }

  @Post('import')
  @ApiOperation({ summary: 'Importa clientes em massa via arquivo Excel (.xlsx)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    return await this.clientsService.importFromExcel(file.buffer);
  }

  @Delete('maintenance/clean-duplicates')
  @ApiOperation({ summary: 'Remove duplicatas de CNPJ+Empresa e corrige erros visuais' })
  async cleanDatabase() {
    return await this.clientsService.cleanDatabaseDuplicates();
  }

  @Get()
  @ApiOperation({ summary: 'Lista clientes com paginação e busca otimizada' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Número da página' })
  @ApiQuery({ name: 'limit', required: false, example: 10, description: 'Quantidade por página' })
  @ApiQuery({ name: 'search', required: false, description: 'Busca por Razão Social ou CNPJ' })
  findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string
  ) {
    // Agora o findAll recebe os parâmetros de otimização
    return this.clientsService.findAll(Number(page), Number(limit), search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um cliente pelo ID' })
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza os dados de um cliente' })
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto) {
    return this.clientsService.update(+id, updateClientDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um cliente do sistema' })
  remove(@Param('id') id: string) {
    return this.clientsService.remove(+id);
  }
}
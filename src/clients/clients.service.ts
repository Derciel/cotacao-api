import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
  Logger
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';
import { Client } from './entities/client.entity.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
    private readonly httpService: HttpService,
  ) { }

  private readonly logger = new Logger(ClientsService.name);

  /**
   * BUSCA EXTERNA: Consulta Brasil API e verifica se já existe no banco local.
   * Útil para preenchimento automático e prevenção de duplicidade.
   */
  async findCnpjExternal(cnpj: string) {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`;

    try {
      const { data } = await firstValueFrom(this.httpService.get(url));

      // Verifica duplicidade no banco local antes de retornar
      const existing = await this.clientsRepository.findOne({ where: { cnpj: cnpjLimpo } });

      return {
        isAlreadyRegistered: !!existing,
        registeredId: existing?.id || null,
        data: {
          razao_social: data.razao_social,
          fantasia: (data.nome_fantasia && typeof data.nome_fantasia !== 'object')
            ? String(data.nome_fantasia).trim() : '',
          cnpj: data.cnpj,
          cep: data.cep,
          cidade: data.municipio,
          estado: data.uf,
          empresa_faturamento: existing?.empresa_faturamento || 'NICOPEL',
        }
      };
    } catch (error) {
      throw new NotFoundException('CNPJ não encontrado na base da Brasil API.');
    }
  }

  /**
   * LISTAGEM OTIMIZADA: Implementa paginação para evitar travamentos no Swagger.
   */
  async findAll(page: number = 1, limit: number = 10, search?: string) {
    const skip = (page - 1) * limit;

    const query = this.clientsRepository.createQueryBuilder('client')
      .take(limit)
      .skip(skip)
      .orderBy('client.razao_social', 'ASC');

    if (search) {
      query.where('client.razao_social ILIKE :search OR client.cnpj LIKE :search', {
        search: `%${search}%`
      });
    }

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  /**
   * CREATE: Adiciona trava de segurança contra duplicidade manual.
   */
  async create(createClientDto: CreateClientDto): Promise<Client> {
    const cnpjLimpo = createClientDto.cnpj.replace(/\D/g, '');

    const existing = await this.clientsRepository.findOne({
      where: {
        cnpj: cnpjLimpo,
        empresa_faturamento: createClientDto.empresa_faturamento
      }
    });

    if (existing) {
      throw new ConflictException('Cliente já cadastrado para esta empresa de faturamento.');
    }

    const client = this.clientsRepository.create({
      ...createClientDto,
      cnpj: cnpjLimpo
    });
    return await this.clientsRepository.save(client);
  }

  /**
   * IMPORTAÇÃO EXCEL: Com desduplicação e tratamento de fuso horário (Hoje: 20/01/2026).
   */
  async importFromExcel(buffer: Buffer) {
    try {
      this.logger.log('Iniciando leitura do arquivo Excel...');
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('A planilha está vazia ou não possui abas.');
      }

      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      this.logger.log(`Total de ${data.length} linhas lidas da planilha.`);

      const uniqueClients = new Map<string, any>();
      const now = new Date();

      data.forEach((row: any) => {
        const docLimpo = String(row['CPF/CNPJ'] || row['CNPJ/CPF'] || '').replace(/\D/g, '');
        const empresa = String(row['EMPRESA'] || 'NICOPEL').toUpperCase().trim();
        if (!docLimpo) return;

        const compositeKey = `${docLimpo}_${empresa}`;
        const localidadeRaw = String(row['CIDADE - UF'] || '').trim();
        let cidade = localidadeRaw, estado = 'PR';

        if (localidadeRaw.includes('-')) {
          const partes = localidadeRaw.split('-');
          cidade = partes[0].trim();
          estado = partes[1].trim().toUpperCase().substring(0, 2);
        }

        uniqueClients.set(compositeKey, {
          razao_social: String(row['Razão Social'] || row['RAZÃO SOCIAL'] || '').trim(),
          fantasia: (row['NOME FANTASIA'] && typeof row['NOME FANTASIA'] !== 'object')
            ? String(row['NOME FANTASIA']).trim() : '',
          cnpj: docLimpo,
          cep: String(row['CEP'] || '').replace(/\D/g, ''),
          cidade: cidade || 'Não Informada',
          estado: estado,
          empresa_faturamento: empresa,
          createdAt: now
        });
      });

      if (uniqueClients.size === 0) {
        return { message: 'Nenhum cliente válido encontrado na planilha (verifique se as colunas CPF/CNPJ ou CNPJ/CPF estão preenchidas).', count: 0 };
      }

      this.logger.log(`Iniciando upsert de ${uniqueClients.size} clientes únicos...`);
      const result = await this.clientsRepository.upsert(Array.from(uniqueClients.values()), ['cnpj', 'empresa_faturamento']);

      return {
        message: 'Importação concluída com sucesso.',
        totalLido: data.length,
        totalProcessado: uniqueClients.size,
        result
      };
    } catch (error: any) {
      this.logger.error(`Erro na importação de Excel: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Erro ao processar a planilha: ${error.message}`);
    }
  }

  /**
   * MANUTENÇÃO: Limpa duplicatas e corrige erros de importação.
   */
  async cleanDatabaseDuplicates() {
    try {
      await this.clientsRepository.query(`
        UPDATE "clients" SET "fantasia" = '' WHERE "fantasia" LIKE '%[object Object]%'
      `);

      const duplicates = await this.clientsRepository.query(`
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY "cnpj", "empresa_faturamento" ORDER BY "id" DESC
          ) as row_num FROM "clients"
        ) t WHERE t.row_num > 1
      `);

      if (duplicates.length > 0) {
        await this.clientsRepository.delete(duplicates.map(d => d.id));
        return { message: `${duplicates.length} duplicatas removidas.` };
      }
      return { message: 'Banco de dados limpo.' };
    } catch (error) {
      throw new InternalServerErrorException('Erro na limpeza do banco.');
    }
  }

  // --- MÉTODOS CRUD PADRÃO ---

  async findOne(id: number): Promise<Client> {
    const client = await this.clientsRepository.findOne({ where: { id } });
    if (!client) throw new NotFoundException(`Cliente #${id} não encontrado.`);
    return client;
  }

  async update(id: number, updateDto: UpdateClientDto): Promise<Client> {
    const client = await this.findOne(id);
    this.clientsRepository.merge(client, updateDto);
    return await this.clientsRepository.save(client);
  }

  async remove(id: number): Promise<void> {
    const client = await this.findOne(id);
    await this.clientsRepository.remove(client);
  }
}
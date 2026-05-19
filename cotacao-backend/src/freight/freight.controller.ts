import { Controller, Get, Post, Body, Param, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RodonavesService } from './rodonaves.service.js';
import { FrenetService } from './frenet.service.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../clients/entities/client.entity.js';
import { RegionDeadline } from './entities/region-deadline.entity.js';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@ApiTags('Freight')
@Controller('freight')
export class FreightController {
  constructor(
    private readonly rodonavesService: RodonavesService,
    private readonly frenetService: FrenetService,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(RegionDeadline)
    private readonly regionDeadlineRepository: Repository<RegionDeadline>,
    private readonly httpService: HttpService,
  ) { }

  @Get('tracking/:nf/:cnpj')
  @ApiOperation({ summary: 'Rastreio em tempo real na Rodonaves' })
  async getTracking(@Param('nf') nf: string, @Param('cnpj') cnpj: string) {
    return this.rodonavesService.getTracking(nf, cnpj);
  }

  @Post('simulate')
  @ApiOperation({ summary: 'Simular prazo de entrega por CEP e Cidade' })
  async simulate(@Body() body: { cep: string, cidade?: string }) {
    if (!body.cep) return [];
    return this.frenetService.simulateDeadline(body.cep, body.cidade);
  }

  @Post('resolve-cnpj')
  @ApiOperation({ summary: 'Buscar dados do cliente no banco ou API sem simular' })
  async resolveCnpj(@Body() body: { cnpj: string }) {
    if (!body.cnpj) throw new HttpException('CNPJ não informado', 400);
    
    const cleanCnpj = body.cnpj.replace(/\D/g, '');
    let client = await this.clientRepository.findOne({ where: { cnpj: cleanCnpj } });
    
    if (!client) {
      // Busca na Brasil API se não existir no banco
      const res = await firstValueFrom(
        this.httpService.get(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`)
      ).catch((err) => {
        if (err.response?.status === 429) throw new HttpException('RATE_LIMIT', 429);
        return null;
      });
      
      if (res && res.data) {
        const d = res.data;
        client = this.clientRepository.create({
          cnpj: cleanCnpj,
          razao_social: d.nome_fantasia || d.razao_social || 'Desconhecido',
          fantasia: d.nome_fantasia || d.razao_social || '',
          cep: (d.cep || '').replace(/\D/g, ''),
          cidade: d.municipio || '',
          estado: d.uf || '',
          empresa_faturamento: 'NICOPEL'
        });
        await this.clientRepository.save(client);
      } else {
        throw new HttpException('CNPJ não encontrado na Brasil API', 404);
      }
    }

    return {
      cliente: client.razao_social || client.fantasia,
      cidade: client.cidade,
      uf: client.estado,
      cep: client.cep
    };
  }

  @Post('simulate-cnpj')
  @ApiOperation({ summary: 'Simular prazo buscando no banco ou API' })
  async simulateCnpj(@Body() body: { cnpj: string }) {
    if (!body.cnpj) throw new HttpException('CNPJ não informado', 400);
    
    const cleanCnpj = body.cnpj.replace(/\D/g, '');
    let client = await this.clientRepository.findOne({ where: { cnpj: cleanCnpj } });
    
    if (!client) {
      // Busca na Brasil API se não existir no banco
      const res = await firstValueFrom(
        this.httpService.get(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`)
      ).catch((err) => {
        if (err.response?.status === 429) throw new HttpException('RATE_LIMIT', 429);
        return null;
      });
      
      if (res && res.data) {
        const d = res.data;
        client = this.clientRepository.create({
          cnpj: cleanCnpj,
          razao_social: d.nome_fantasia || d.razao_social || 'Desconhecido',
          fantasia: d.nome_fantasia || d.razao_social || '',
          cep: (d.cep || '').replace(/\D/g, ''),
          cidade: d.municipio || '',
          estado: d.uf || '',
          empresa_faturamento: 'NICOPEL'
        });
        await this.clientRepository.save(client);
      } else {
        throw new HttpException('CNPJ não encontrado na Brasil API', 404);
      }
    }

    // 1. Tentar buscar da tabela region_deadlines (cache/prazos salvos)
    const cidadeUpper = (client.cidade || '').trim().toUpperCase();
    const ufUpper = (client.estado || '').trim().toUpperCase();

    if (cidadeUpper && ufUpper) {
      const cachedDeadlines = await this.regionDeadlineRepository.find({
        where: {
          cidade: cidadeUpper,
          uf: ufUpper
        }
      });

      if (cachedDeadlines && cachedDeadlines.length > 0) {
        console.log(`[FreightController] Usando prazos do banco de dados (cache) para a região: ${cidadeUpper} - ${ufUpper}`);
        const cachedOptions = cachedDeadlines.map(cd => ({
          carrier: cd.carrier,
          service_description: cd.carrier,
          price: 0,
          deadline: cd.deadline,
          percentage: 0,
          recommendation: 'normal' as const
        }));

        return {
          cliente: client.razao_social || client.fantasia,
          cidade: client.cidade,
          uf: client.estado,
          cep: client.cep,
          options: cachedOptions
        };
      }
    }

    // 2. Se não houver no banco, realiza a simulação na API externa
    const options = await this.frenetService.simulateDeadline(client.cep, client.cidade);
    
    // 3. Salvar as opções simuladas no banco de dados para consultas futuras
    if (options && options.length > 0 && cidadeUpper && ufUpper) {
      for (const opt of options) {
        if (opt.deadline > 0) {
          try {
            const carrierUpper = (opt.carrier || '').trim().toUpperCase();
            let regionDeadline = await this.regionDeadlineRepository.findOne({
              where: {
                cidade: cidadeUpper,
                uf: ufUpper,
                carrier: carrierUpper
              }
            });

            if (regionDeadline) {
              regionDeadline.deadline = opt.deadline;
              regionDeadline.cep_prefix = client.cep ? client.cep.replace(/\D/g, '').substring(0, 5) : '';
              await this.regionDeadlineRepository.save(regionDeadline);
            } else {
              const newRd = this.regionDeadlineRepository.create({
                cidade: cidadeUpper,
                uf: ufUpper,
                carrier: carrierUpper,
                deadline: opt.deadline,
                cep_prefix: client.cep ? client.cep.replace(/\D/g, '').substring(0, 5) : ''
              });
              await this.regionDeadlineRepository.save(newRd);
            }
          } catch (e: any) {
            console.warn(`[FreightController] Falha ao salvar prazo no banco de dados para ${cidadeUpper}:`, e.message);
          }
        }
      }
    }

    return {
      cliente: client.razao_social || client.fantasia,
      cidade: client.cidade,
      uf: client.estado,
      cep: client.cep,
      options
    };
  }
}
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout } from 'rxjs';
import { ApiKey } from '../entities/api-key.entity.js';
import { Truck } from '../entities/truck.entity.js';

interface PositionData {
  latitude: number;
  longitude: number;
  speed?: number;
  timestamp: Date;
  status?: string;
}

@Injectable()
export class PositionService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(Truck)
    private readonly truckRepository: Repository<Truck>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Obtém a posição atual de um caminhão pela placa
   * @param licensePlate - Placa do caminhão
   * @returns Dados de posição do caminhão
   */
  async getPositionByLicensePlate(licensePlate: string): Promise<PositionData> {
    // Busca o caminhão pelo placa
    const truck = await this.truckRepository.findOne({
      where: { licensePlate: licensePlate.toUpperCase() },
    });

    if (!truck) {
      throw new NotFoundException(`Caminhão com placa ${licensePlate} não encontrado`);
    }

    // Busca a chave API mais recente e válida para o usuário (assumindo que há um usuário associado)
    // Neste exemplo, vamos usar a primeira chave ativa encontrada (em um sistema real, seria associada ao usuário logado)
    const apiKey = await this.apiKeyRepository.findOne({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });

    if (!apiKey) {
      throw new NotFoundException('Nenhuma chave de API Systemsatx configurada');
    }

    // Verifica se a chave está válida (não expirada)
    if (apiKey.expiresAt && new Date() > new Date(apiKey.expiresAt)) {
      throw new NotFoundException('Chave de API Systemsatx expirada');
    }

    try {
      // Faz a requisição para a API Systemsatx
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.configService.get<string>('SYSTEMSATX_BASE_URL')}/api/rastreamento`,
          {
            params: { placa: licensePlate },
            headers: {
              Authorization: `Bearer ${apiKey.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        ).pipe(timeout(10000))
      );

      // Assume que a resposta da API Systemsatx está no formato:
      // { latitude: number, longitude: number, speed?: number, timestamp: string, status?: string }
      const data = response.data;

      return {
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed,
        timestamp: new Date(data.timestamp),
        status: data.status,
      };
    } catch (error: any) {
      console.error('Erro ao obter posição do Systemsatx:', error);
      if (error.response && error.response.status === 401) {
        throw new NotFoundException('Chave de API Systemsatx inválida');
      }
      throw new InternalServerErrorException('Erro ao comunicar com Systemsatx');
    }
  }

  /**
   * Obtém posições de múltiplos caminhões
   * @param licensePlates - Array de placas dos caminhões
   * @returns Promise que resolve com um mapa de placa para dados de posição
   */
  async getMultiplePositions(licensePlates: string[]): Promise<Record<string, PositionData>> {
    const results: Record<string, PositionData> = {};

    // Processa em paralelo, mas com limite para não sobrecarregar a API
    const chunks = this.chunkArray(licensePlates, 5); // Processa 5 por vez

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (plate) => {
        try {
          const position = await this.getPositionByLicensePlate(plate);
          return { plate, position };
        } catch (error) {
          return { plate, position: null, error };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      for (const result of chunkResults) {
        if (result.position) {
          results[result.plate] = result.position;
        }
        // Em um sistema real, você poderia logar os erros aqui
      }

      // Pequena pausa entre chunks para respeitar rate limits
      if (chunk !== chunks[chunks.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Divide um array em chunks de tamanho especificado
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
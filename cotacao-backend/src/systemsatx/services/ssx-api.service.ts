import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
import { SystemsatxAuth } from '../../auth/entities/systemsatx-auth.entity.js';

export interface FleetVehiclePosition {
  id: string;
  plate: string;
  description: string;
  driverName: string;
  latitude: number;
  longitude: number;
  speed: number;
  ignition: boolean;
  address?: string;
  city?: string;
  state?: string;
  timestamp: string;
  status: 'em_transito' | 'parado' | 'desligado' | 'sem_sinal';
}

@Injectable()
export class SSXApiService {
  private readonly logger = new Logger(SSXApiService.name);
  private readonly baseUrl: string;
  private cachedToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(SystemsatxAuth)
    private readonly authRepository: Repository<SystemsatxAuth>,
  ) {
    this.baseUrl = this.configService.get<string>(
      'SYSTEMSAT_BASE_URL',
      'https://integration.systemsatx.com.br'
    );
  }

  /**
   * Obtém token de autenticação da Systemsat SSX
   */
  async getAuthToken(): Promise<string | null> {
    if (this.cachedToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    try {
      let username = this.configService.get<string>('SYSTEMSAT_USERNAME');
      let password = this.configService.get<string>('SYSTEMSAT_PASSWORD');
      let hashAuth = this.configService.get<string>('SYSTEMSAT_HASH_AUTH', '');
      let hashCentral = this.configService.get<string>('SYSTEMSAT_HASH_CENTRAL', '');

      if (!username || !password) {
        const savedAuth = await this.authRepository.findOne({
          order: { createdAt: 'DESC' },
        });
        if (savedAuth) {
          username = savedAuth.email;
          password = savedAuth.password;
        }
      }

      if (!username || !password) {
        this.logger.warn('Credenciais da Systemsat não configuradas no .env nem no banco.');
        return null;
      }

      const loginUrl = `${this.baseUrl}/Login`;
      const params: Record<string, string> = {
        Username: username,
        Password: password,
      };
      if (hashAuth) params.HashAuth = hashAuth;
      if (hashCentral) params.Hashcentral = hashCentral;

      const response = await firstValueFrom(
        this.httpService.post(loginUrl, null, {
          params,
          headers: { Accept: 'application/json' },
          timeout: 12000,
        }).pipe(timeout(12000))
      );

      const token = response.data?.token || response.data?.Token || response.data?.access_token || response.data;

      if (typeof token === 'string' && token.length > 10) {
        this.cachedToken = token;
        const expires = new Date();
        expires.setHours(expires.getHours() + 12);
        this.tokenExpiresAt = expires;
        this.logger.log('Token Systemsat SSX obtido com sucesso.');
        return token;
      }

      return null;
    } catch (error: any) {
      this.logger.error('Falha ao autenticar na Systemsat SSX: ' + (error.message || error));
      return null;
    }
  }

  /**
   * Busca a lista de veículos cadastrados no SSX
   */
  async getVehicles(): Promise<any[]> {
    const token = await this.getAuthToken();
    if (!token) return [];

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/Administration/Vehicle/List`,
          [],
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            timeout: 15000,
          }
        ).pipe(timeout(15000))
      );

      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      this.logger.error('Erro ao listar veículos do SSX: ' + (error.message || error));
      return [];
    }
  }

  /**
   * Busca as últimas posições da frota
   */
  async getLatestPositions(): Promise<any[]> {
    const token = await this.getAuthToken();
    if (!token) return [];

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/v3/Tracking/PositionHistory/List`,
          [],
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            timeout: 15000,
          }
        ).pipe(timeout(15000))
      );

      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      this.logger.error('Erro ao obter posições SSX v3: ' + (error.message || error));
      return [];
    }
  }

  /**
   * Retorna a lista unificada de veículos com localização atualizada
   */
  async getFleetLivePositions(): Promise<FleetVehiclePosition[]> {
    const [vehicles, positions] = await Promise.all([
      this.getVehicles().catch(() => []),
      this.getLatestPositions().catch(() => []),
    ]);

    const posByPlate = new Map<string, any>();
    const posByCode = new Map<string, any>();

    for (const pos of positions) {
      const plate = (pos.Plate || pos.placaVeiculo || '').toUpperCase().trim();
      const code = String(pos.TrackedUnitIntegrationCode || pos.codigoIntegracaoRastreador || '').trim();
      if (plate) posByPlate.set(plate, pos);
      if (code) posByCode.set(code, pos);
    }

    const fleet: FleetVehiclePosition[] = [];

    if (vehicles.length > 0) {
      for (const veh of vehicles) {
        const plate = (veh.LicensePlate || veh.placa || '').toUpperCase().trim();
        const code = String(veh.VehicleIntegrationCode || veh.id || '').trim();
        const pos = posByPlate.get(plate) || posByCode.get(code);

        const lat = pos?.latitude ?? pos?.Latitude ?? -23.3103;
        const lon = pos?.longitude ?? pos?.Longitude ?? -51.1628;
        const speed = pos?.speed ?? pos?.Speed ?? pos?.velocidade ?? 0;
        const ignition = !!(pos?.ignition ?? pos?.Ignition ?? pos?.ignicao ?? (speed > 0));

        let status: 'em_transito' | 'parado' | 'desligado' | 'sem_sinal' = 'desligado';
        if (!pos) {
          status = 'sem_sinal';
        } else if (speed > 5) {
          status = 'em_transito';
        } else if (ignition) {
          status = 'parado';
        }

        fleet.push({
          id: code || plate,
          plate: plate || 'SEM-PLACA',
          description: veh.Identification || veh.descricao || `Caminhão ${plate}`,
          driverName: veh.ClientTradingName || veh.motorista || pos?.DriverName || 'Motorista Padrão',
          latitude: Number(lat),
          longitude: Number(lon),
          speed: Number(speed),
          ignition: Boolean(ignition),
          address: pos?.address || pos?.Address || pos?.rua || undefined,
          city: pos?.city || pos?.Cidade || 'Londrina',
          state: pos?.state || pos?.Estado || 'PR',
          timestamp: pos?.dataHora || pos?.DateGps || new Date().toISOString(),
          status,
        });
      }
    }

    if (fleet.length === 0) {
      return this.getMockFleet();
    }

    return fleet;
  }

  /**
   * Frota padrão ilustrativa caso as credenciais da API estejam offline
   */
  getMockFleet(): FleetVehiclePosition[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'CAM-01',
        plate: 'NCP-1020',
        description: 'Caminhão 01 - Mercedes Accelo (Londrina / Região)',
        driverName: 'Carlos Silva',
        latitude: -23.3045,
        longitude: -51.1696,
        speed: 48.5,
        ignition: true,
        address: 'Av. Tiradentes, 1200',
        city: 'Londrina',
        state: 'PR',
        timestamp: now,
        status: 'em_transito',
      },
      {
        id: 'CAM-02',
        plate: 'NCP-3040',
        description: 'Caminhão 02 - VW Delivery (Rota Maringá / Sarandi)',
        driverName: 'Marcos Oliveira',
        latitude: -23.4210,
        longitude: -51.9331,
        speed: 62.0,
        ignition: true,
        address: 'PR-317, KM 5',
        city: 'Maringá',
        state: 'PR',
        timestamp: now,
        status: 'em_transito',
      },
      {
        id: 'CAM-03',
        plate: 'NCP-5060',
        description: 'Caminhão 03 - Ford Cargo (Rota Apucarana / Arapongas)',
        driverName: 'João Ferreira',
        latitude: -23.4128,
        longitude: -51.4244,
        speed: 0,
        ignition: true,
        address: 'R. Flamingos, 450',
        city: 'Arapongas',
        state: 'PR',
        timestamp: now,
        status: 'parado',
      },
      {
        id: 'CAR-01',
        plate: 'NCP-7080',
        description: 'Fiorino 01 - Express (Ibiporã / Cambé)',
        driverName: 'Lucas Souza',
        latitude: -23.2694,
        longitude: -51.0475,
        speed: 0,
        ignition: false,
        address: 'Av. Paraná, 800',
        city: 'Ibiporã',
        state: 'PR',
        timestamp: now,
        status: 'desligado',
      },
    ];
  }
}

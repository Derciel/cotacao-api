import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route } from '../entities/route.entity.js';
import { Truck } from '../entities/truck.entity.js';
import { RouteCreationDto, RouteUpdateDto } from '../interfaces/route.interface.js';

interface Coord {
  latitude: number;
  longitude: number;
}

interface DeviationResult {
  isDeviated: boolean;
  distance: number; // distance in meters from route
  threshold: number; // configured threshold in meters
  closestPoint: Coord;
  routeId: number;
}

@Injectable()
export class DeviationService {
  constructor(
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
    @InjectRepository(Truck)
    private readonly truckRepository: Repository<Truck>,
  ) {}

  /**
   * Verifica se um caminhão desviou da rota
   * @param truckId - ID do caminhão
   * @param latitude - Latitude atual
   * @param longitude - Longitude atual
   * @returns Resultado da verificação de desvio ou null se não houver rota ativa
   */
  async checkDeviation(
    truckId: number,
    latitude: number,
    longitude: number,
  ): Promise<DeviationResult | null> {
    // Busca a rota ativa para o caminhão
    const route = await this.routeRepository.findOne({
      where: { truckId },
      relations: ['truck'],
    });

    if (!route) {
      // Nenhuma rota definida para este caminhão
      return null;
    }

    // Calcula a distância do ponto atual para a rota mais próxima
    const { distance, closestPoint } = this.calculateDistanceToRoute(
      latitude,
      longitude,
      route.coordinates,
    );

    // Verifica se ultrapassou o limiar
    const isDeviated = distance > route.deviationThreshold;

    return {
      isDeviated,
      distance,
      threshold: route.deviationThreshold,
      closestPoint,
      routeId: route.id,
    };
  }

  /**
   * Calcula a distância mínima de um ponto para uma rota (polyline)
   * Usa o algoritmo de distância ponto-segmento para cada segmento da rota
   * @param lat - Latitude do ponto
   * @param lng - Longitude do ponto
   * @param routeCoordinates - Array de coordenadas da rota
   * @returns Objeto com distância mínima e ponto mais próximo
   */
  calculateDistanceToRoute(
    lat: number,
    lng: number,
    routeCoordinates: Coord[],
  ): { distance: number; closestPoint: Coord } {
    if (!routeCoordinates || routeCoordinates.length === 0) {
      return { distance: Infinity, closestPoint: { latitude: lat, longitude: lng } };
    }

    if (routeCoordinates.length === 1) {
      // Rota com apenas um ponto
      const distance = this.haversineDistance(
        lat,
        lng,
        routeCoordinates[0].latitude,
        routeCoordinates[0].longitude,
      );
      return {
        distance,
        closestPoint: routeCoordinates[0],
      };
    }

    let minDistance = Infinity;
    let closestPoint: Coord = routeCoordinates[0];

    // Verifica distância para cada segmento da rota
    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      const start = routeCoordinates[i];
      const end = routeCoordinates[i + 1];

      const { distance, point } = this.distanceToSegment(
        lat,
        lng,
        start.latitude,
        start.longitude,
        end.latitude,
        end.longitude,
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    }

    // Também verifica distância aos vértices (caso o ponto mais próximo seja um vértice)
    for (const coord of routeCoordinates) {
      const distance = this.haversineDistance(
        lat,
        lng,
        coord.latitude,
        coord.longitude,
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = coord;
      }
    }

    return {
      distance: minDistance,
      closestPoint,
    };
  }

  /**
   * Calcula a distância de um ponto para um segmento de linha usando projeção vetorial
   * @param lat, lng - Ponto a ser verificado
   * @param lat1, lng1 - Início do segmento
   * @param lat2, lng2 - Fim do segmento
   * @returns Distância mínima e ponto mais próximo no segmento
   */
  private distanceToSegment(
    lat: number,
    lng: number,
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): { distance: number; point: Coord } {
    // Converte para coordenadas cartesianas aproximadas (para pequenas distâncias)
    const A = { x: lat1, y: lng1 };
    const B = { x: lat2, y: lng2 };
    const P = { x: lat, y: lng };

    // Vetor AB
    const AB = { x: B.x - A.x, y: B.y - A.y };
    // Vetor AP
    const AP = { x: P.x - A.x, y: P.y - A.y };
    // Vetor BP
    const BP = { x: P.x - B.x, y: P.y - B.y };

    // Produto escalar AB·AP
    const ab_ap = AB.x * AP.x + AB.y * AP.y;
    // Produto escalar BA·BP (equivalente a -AB·BP)
    const ba_bp = (-AB.x) * BP.x + (-AB.y) * BP.y;

    // Comprimento ao quadrado de AB
    const ab2 = AB.x * AB.x + AB.y * AB.y;

    let closestPoint: Coord;

    if (ab_ap <= 0) {
      // P está antes de A no segmento AB
      closestPoint = { latitude: A.x, longitude: A.y };
    } else if (ba_bp <= 0) {
      // P está depois de B no segmento AB
      closestPoint = { latitude: B.x, longitude: B.y };
    } else {
      // P está entre A e B, projetar no segmento
      const t = ab_ap / ab2;
      closestPoint = {
        latitude: A.x + t * AB.x,
        longitude: A.y + t * AB.y,
      };
    }

    // Converte de volta para lat/lng (aproximação válida para pequenas distâncias)
    const distance = this.haversineDistance(
      lat,
      lng,
      closestPoint.latitude,
      closestPoint.longitude,
    );

    return {
      distance,
      point: closestPoint,
    };
  }

  /**
   * Calcula a distância haversine entre duas coordenadas geográficas
   * @returns Distância em metros
   */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Raio da Terra em metros
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distância em metros
  }

  /**
   * Cria uma nova rota para um caminhão
   */
  async createRoute(
    truckId: number,
    routeData: RouteCreationDto,
  ): Promise<Route> {
    // Valida se o caminhão existe
    const truck = await this.truckRepository.findOne({ where: { id: truckId } });
    if (!truck) {
      throw new NotFoundException(`Caminhão com id ${truckId} não encontrado`);
    }

    const route = this.routeRepository.create();
    route.name = routeData.name;
    route.coordinates = routeData.coordinates;
    if (routeData.expectedPath !== undefined) {
      route.expectedPath = routeData.expectedPath ?? undefined;
    }
    route.deviationThreshold = routeData.deviationThreshold ?? 100;
    route.truckId = truckId;

    return await this.routeRepository.save(route);
  }

  /**
   * Atualiza uma rota existente
   */
  async updateRoute(
    routeId: number,
    routeData: RouteUpdateDto,
  ): Promise<Route> {
    const existing = await this.routeRepository.findOne({ where: { id: routeId } });
    if (!existing) {
      throw new NotFoundException(`Rota com id ${routeId} não encontrada`);
    }

    if (routeData.name !== undefined) {
      existing.name = routeData.name;
    }
    if (routeData.coordinates !== undefined) {
      existing.coordinates = routeData.coordinates;
    }
    if (routeData.expectedPath !== undefined) {
      existing.expectedPath = routeData.expectedPath ?? undefined;
    }
    if (routeData.deviationThreshold !== undefined) {
      existing.deviationThreshold = routeData.deviationThreshold;
    }
    if (routeData.truckId !== undefined) {
      existing.truckId = routeData.truckId;
    }

    return await this.routeRepository.save(existing);
  }

  /**
   * Busca rota por ID
   */
  async getRouteById(routeId: number): Promise<Route | null> {
    return await this.routeRepository.findOne({ where: { id: routeId } });
  }

  /**
   * Busca todas as rotas de um caminhão
   */
  async getRoutesByTruckId(truckId: number): Promise<Route[]> {
    return await this.routeRepository.find({
      where: { truckId },
      order: { createdAt: 'DESC' },
    });
  }
}
import { Injectable } from '@nestjs/common';

export interface RouteDaySchedule {
  dayOfWeek: string;
  dayName: string;
  cities: string[];
  description: string;
}

@Injectable()
export class RouteScheduleService {
  private readonly defaultSchedule: RouteDaySchedule[] = [
    {
      dayOfWeek: 'segunda',
      dayName: 'Segunda-feira',
      cities: ['LONDRINA'],
      description: 'Entregas locais em Londrina',
    },
    {
      dayOfWeek: 'terca',
      dayName: 'Terça-feira',
      cities: ['IBIPORÃ', 'IBIPORA'],
      description: 'Rota Ibiporã e proximidades',
    },
    {
      dayOfWeek: 'quarta',
      dayName: 'Quarta-feira',
      cities: ['LONDRINA'],
      description: 'Entregas locais em Londrina (2º ciclo)',
    },
    {
      dayOfWeek: 'quinta',
      dayName: 'Quinta-feira',
      cities: ['APUCARANA', 'ARAPONGAS', 'JANDAIA DO SUL', 'CAMBÉ', 'CAMBE', 'ROLÂNDIA', 'ROLANDIA'],
      description: 'Rota Vale do Ivaí / Região Metropolitana Oeste',
    },
    {
      dayOfWeek: 'sexta',
      dayName: 'Sexta-feira',
      cities: ['MARINGÁ', 'MARINGA', 'MANDAGUARI', 'SARANDI', 'MARIALVA', 'CAMBÉ', 'CAMBE', 'CIANORTE', 'PARANAVAÍ', 'PARANAVAI', 'JANDAIA', 'JANDAIA DO SUL'],
      description: 'Rota Noroeste / Eixo Maringá - Cianorte - Paranavaí',
    },
  ];

  /**
   * Retorna todo o cronograma semanal de rotas
   */
  getSchedule(): RouteDaySchedule[] {
    return this.defaultSchedule;
  }

  /**
   * Retorna as cidades atendidas em determinado dia
   */
  getCitiesByDay(day: string): string[] {
    const normalized = this.normalize(day);
    const found = this.defaultSchedule.find(s => this.normalize(s.dayOfWeek) === normalized || this.normalize(s.dayName) === normalized);
    return found ? found.cities : [];
  }

  /**
   * Verifica se uma cidade pertence à rota do dia
   */
  isCityInDayRoute(city: string, day: string): boolean {
    const cities = this.getCitiesByDay(day);
    const normCity = this.normalize(city);
    return cities.some(c => this.normalize(c) === normCity);
  }

  private normalize(str: string): string {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}

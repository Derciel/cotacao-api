import { Injectable, Logger } from '@nestjs/common';

export interface FuelPrices {
  dieselS10: number;
  gasolina: number;
  etanol: number;
}

@Injectable()
export class FuelsService {
  private readonly logger = new Logger(FuelsService.name);

  // Catálogo consolidado de preços médios por Estado (UF) baseado em levantamentos recentes oficiais da ANP
  private readonly statePrices: Record<string, FuelPrices> = {
    AC: { dieselS10: 7.30, gasolina: 6.90, etanol: 4.80 },
    AL: { dieselS10: 6.10, gasolina: 5.95, etanol: 4.20 },
    AM: { dieselS10: 6.45, gasolina: 6.30, etanol: 4.50 },
    AP: { dieselS10: 6.60, gasolina: 6.10, etanol: 4.90 },
    BA: { dieselS10: 6.05, gasolina: 6.00, etanol: 4.30 },
    CE: { dieselS10: 6.15, gasolina: 6.10, etanol: 4.40 },
    DF: { dieselS10: 5.95, gasolina: 5.80, etanol: 3.90 },
    ES: { dieselS10: 5.90, gasolina: 5.85, etanol: 4.10 },
    GO: { dieselS10: 5.95, gasolina: 5.75, etanol: 3.80 },
    MA: { dieselS10: 6.00, gasolina: 5.85, etanol: 4.25 },
    MG: { dieselS10: 5.85, gasolina: 5.70, etanol: 3.80 },
    MS: { dieselS10: 5.90, gasolina: 5.75, etanol: 3.75 },
    MT: { dieselS10: 6.10, gasolina: 5.90, etanol: 3.65 },
    PA: { dieselS10: 6.25, gasolina: 6.10, etanol: 4.60 },
    PB: { dieselS10: 6.05, gasolina: 5.85, etanol: 4.15 },
    PE: { dieselS10: 6.00, gasolina: 5.90, etanol: 4.20 },
    PI: { dieselS10: 6.10, gasolina: 5.95, etanol: 4.35 },
    PR: { dieselS10: 5.88, gasolina: 5.80, etanol: 3.95 },
    RJ: { dieselS10: 6.00, gasolina: 5.85, etanol: 4.10 },
    RN: { dieselS10: 6.15, gasolina: 6.05, etanol: 4.35 },
    RO: { dieselS10: 6.50, gasolina: 6.20, etanol: 4.70 },
    RR: { dieselS10: 6.80, gasolina: 6.50, etanol: 5.00 },
    RS: { dieselS10: 5.92, gasolina: 5.95, etanol: 4.20 },
    SC: { dieselS10: 5.95, gasolina: 5.90, etanol: 4.15 },
    SE: { dieselS10: 6.10, gasolina: 6.00, etanol: 4.25 },
    SP: { dieselS10: 5.85, gasolina: 5.68, etanol: 3.65 },
    TO: { dieselS10: 6.15, gasolina: 5.95, etanol: 4.30 }
  };

  private readonly nationalFallback: FuelPrices = {
    dieselS10: 6.05,
    gasolina: 5.90,
    etanol: 3.98
  };

  getAveragePrices(): Record<string, FuelPrices> {
    this.logger.log('Buscando base completa de preços de combustíveis');
    return this.statePrices;
  }

  getPriceByUf(uf: string): FuelPrices {
    const cleanUf = (uf || '').toUpperCase().trim();
    if (this.statePrices[cleanUf]) {
      return this.statePrices[cleanUf];
    }
    this.logger.warn(`UF '${uf}' não localizada. Utilizando fallback nacional de combustíveis.`);
    return this.nationalFallback;
  }
}

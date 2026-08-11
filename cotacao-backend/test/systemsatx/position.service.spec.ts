import { Test, TestingModule } from '@nestjs/testing';
import { PositionService } from '../src/systemsatx/services/position.service';
import { DeviationService } from '../src/systemsatx/services/deviation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '../src/systemsatx/entities/api-key.entity';
import { Truck } from '../src/systemsatx/entities/truck.entity';

describe('PositionService', () => {
  let service: PositionService;
  let deviationService: DeviationService;
  let apiKeyRepository: Repository<ApiKey>;
  let truckRepository: Repository<Truck>;

  const mockDeviationService = {
    checkDeviation: jest.fn(),
  };

  const mockApiKeyRepository = {
    findOne: jest.fn(),
  };

  const mockTruckRepository = {
    findOne: jest.fn(),
  };

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionService,
        {
          provide: DeviationService,
          useValue: mockDeviationService,
        },
        {
          provide: getRepositoryToken(ApiKey),
          useValue: mockApiKeyRepository,
        },
        {
          provide: getRepositoryToken(Truck),
          useValue: mockTruckRepository,
        },
        {
          provide: 'HTTP_SERVICE',
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PositionService>(PositionService);
    deviationService = module.get<DeviationService>(DeviationService);
    apiKeyRepository = module.get<Repository<ApiKey>>(getRepositoryToken(ApiKey));
    truckRepository = module.get<Repository<Truck>>(getRepositoryToken(Truck));
  });

  describe('getPositionByLicensePlate', () => {
    it('should throw NotFoundException when truck not found', async () => {
      mockTruckRepository.findOne.mockResolvedValue(null);

      await expect(service.getPositionByLicensePlate('ABC123'))
        .rejects
        .toThrowErrorMatchingInlineSnapshot(
          `"NotFoundException: Caminhão com placa ABC123 não encontrado"`
        );
    });

    it('should throw NotFoundException when no active API key found', async () => {
      mockTruckRepository.findOne.mockResolvedValue({ id: 1, licensePlate: 'ABC123' });
      mockApiKeyRepository.findOne.mockResolvedValue(null);

      await expect(service.getPositionByLicensePlate('ABC123'))
        .rejects
        .toThrowErrorMatchingInlineSnapshot(
          `"NotFoundException: Nenhuma chave de API Systemsatx configurada"`
        );
    });

    it('should throw NotFoundException when API key expired', async () => {
      mockTruckRepository.findOne.mockResolvedValue({ id: 1, licensePlate: 'ABC123' });
      mockApiKeyRepository.findOne.mockResolvedValue({
        id: 1,
        key: 'test-key',
        expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
        isActive: true,
      });

      await expect(service.getPositionByLicensePlate('ABC123'))
        .rejects
        .toThrowErrorMatchingInlineSnapshot(
          `"NotFoundException: Chave de API Systemsatx expirada"`
        );
    });

    it('should return position data when successful', async () => {
      mockTruckRepository.findOne.mockResolvedValue({ id: 1, licensePlate: 'ABC123' });
      mockApiKeyRepository.findOne.mockResolvedValue({
        id: 1,
        key: 'test-key',
        expiresAt: new Date(Date.now() + 3600000), // Valid for 1 hour
        isActive: true,
      });
      mockConfigService.get.mockReturnValue('https://api.systemsatx.com');
      mockHttpService.get.mockResolvedValue({
        data: {
          latitude: -23.5505,
          longitude: -46.6333,
          speed: 60,
          timestamp: new Date().toISOString(),
          status: 'active',
        },
      });

      const result = await service.getPositionByLicensePlate('ABC123');

      expect(result).toEqual({
        latitude: -23.5505,
        longitude: -46.6333,
        speed: 60,
        timestamp: expect.any(Date),
        status: 'active',
      });
    });
  });

  describe('getMultiplePositions', () => {
    it('should process multiple plates in chunks', async () => {
      mockTruckRepository.findOne.mockImplementation((options) => {
        if (options.where.licensePlate === 'ABC123') {
          return Promise.resolve({ id: 1, licensePlate: 'ABC123' });
        }
        if (options.where.licensePlate === 'XYZ789') {
          return Promise.resolve({ id: 2, licensePlate: 'XYZ789' });
        }
        return Promise.resolve(null);
      });

      mockApiKeyRepository.findOne.mockResolvedValue({
        id: 1,
        key: 'test-key',
        expiresAt: new Date(Date.now() + 3600000),
        isActive: true,
      });
      mockConfigService.get.mockReturnValue('https://api.systemsatx.com');
      mockHttpService.get.mockImplementation((url, config) => {
        const plateMatch = config.params.placa.match(/([A-Z]{3}\d{3})/);
        if (plateMatch) {
          const plate = plateMatch[1];
          return Promise.resolve({
            data: {
              latitude: plate === 'ABC123' ? -23.5505 : -23.5510,
              longitude: plate === 'ABC123' ? -46.6333 : -46.6338,
              speed: 60,
              timestamp: new Date().toISOString(),
              status: 'active',
            },
          });
        }
        return Promise.resolve({ data: null });
      });

      const result = await service.getMultiplePositions(['ABC123', 'XYZ789']);

      expect(result).toHaveProperty('ABC123');
      expect(result).toHaveProperty('XYZ789');
      expect(result.ABC123.latitude).toBeCloseTo(-23.5505, 4);
      expect(result.XYZ789.latitude).toBeCloseTo(-23.5510, 4);
    });
  });

  describe('chunkArray', () => {
    it('should split array into chunks of specified size', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const chunks = (service as any).chunkArray(array, 3);

      expect(chunks).toHaveLength(4);
      expect(chunks[0]).toEqual([1, 2, 3]);
      expect(chunks[1]).toEqual([4, 5, 6]);
      expect(chunks[2]).toEqual([7, 8, 9]);
      expect(chunks[3]).toEqual([10]);
    });

    it('should handle empty array', () => {
      const chunks = (service as any).chunkArray([], 5);
      expect(chunks).toHaveLength(0);
    });

    it('should handle array smaller than chunk size', () => {
      const chunks = (service as any).chunkArray([1, 2, 3], 10);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual([1, 2, 3]);
    });
  });
});
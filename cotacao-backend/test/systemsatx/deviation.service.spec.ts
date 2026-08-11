import { Test, TestingModule } from '@nestjs/testing';
import { DeviationService } from '../src/systemsatx/services/deviation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Route } from '../src/systemsatx/entities/route.entity';
import { Truck } from '../src/systemsatx/entities/truck.entity';
import { Repository } from 'typeorm';

describe('DeviationService', () => {
  let service: DeviationService;
  let routeRepository: Repository<Route>;
  let truckRepository: Repository<Truck>;

  const mockRouteRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
  };

  const mockTruckRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviationService,
        {
          provide: getRepositoryToken(Route),
          useValue: mockRouteRepository,
        },
        {
          provide: getRepositoryToken(Truck),
          useValue: mockTruckRepository,
        },
      ],
    }).compile();

    service = module.get<DeviationService>(DeviationService);
    routeRepository = module.get<Repository<Route>>(getRepositoryToken(Route));
    truckRepository = module.get<Repository<Truck>>(getRepositoryToken(Truck));
  });

  describe('haversineDistance', () => {
    it('should calculate distance between two points correctly', () => {
      // Test distance between two known points (approximately 111km for 1 degree latitude)
      const distance = (service as any).haversineDistance(0, 0, 1, 0);
      expect(distance).toBeCloseTo(111000, -2); // Approximately 111km in meters
    });

    it('should return 0 for same point', () => {
      const distance = (service as any).haversineDistance(0, 0, 0, 0);
      expect(distance).toBe(0);
    });
  });

  describe('pointToLineDistance', () => {
    it('should calculate distance from point to line segment correctly', () => {
      // Point (0,1) to line from (0,0) to (0,2) should be 0 (on the line)
      const distance = (service as any).pointToLineDistance(0, 1, 0, 0, 0, 2);
      expect(distance).toBeCloseTo(0, -2);
    });

    it('should calculate distance from point to line segment endpoint', () => {
      // Point (1,0) to line from (0,0) to (0,2) should be distance to (0,0)
      const distance = (service as any).pointToLineDistance(1, 0, 0, 0, 0, 2);
      expect(distance).toBeCloseTo(111000, -2); // Approximately 111km
    });
  });

  describe('calculateDistanceToRoute', () => {
    it('should return Infinity for empty route', () => {
      const distance = (service as any).calculateDistanceToRoute(0, 0, []);
      expect(distance).toBe(Infinity);
    });

    it('should calculate distance to single point route', () => {
      const route = [{ latitude: 0, longitude: 0 }];
      const distance = (service as any).calculateDistanceToRoute(0, 0.01, route);
      expect(distance).toBeCloseTo(1110, -1); // Approximately 1.11km
    });

    it('should calculate minimum distance to multi-point route', () => {
      const route = [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 0.01 },
        { latitude: 0.01, longitude: 0.01 },
      ];
      // Point (0.005, 0.005) should be closest to middle segment
      const distance = (service as any).calculateDistanceToRoute(0.005, 0.005, route);
      expect(distance).toBeCloseTo(0, -2); // Very close to route
    });
  });

  describe('checkDeviation', () => {
    it('should return null when no route found', async () => {
      mockRouteRepository.findOne.mockResolvedValue(null);

      const result = await service.checkDeviation(1, 0, 0);
      expect(result).toBeNull();
    });

    it('should return deviation info when threshold exceeded', async () => {
      const mockRoute = {
        id: 1,
        name: 'Test Route',
        coordinates: [{ latitude: 0, longitude: 0 }],
        deviationThreshold: 50, // 50 meters
        truckId: 1,
      };
      const mockTruck = { id: 1, licensePlate: 'ABC123' };

      mockRouteRepository.findOne.mockResolvedValue(mockRoute);
      mockTruckRepository.findOne.mockResolvedValue(mockTruck);

      // Point ~1km away should exceed 50m threshold
      const result = await service.checkDeviation(1, 0, 0.009);

      expect(result).toBeDefined();
      expect(result.isDeviated).toBe(true);
      expect(result.distance).toBeGreaterThan(50);
      expect(result.threshold).toBe(50);
      expect(result.routeId).toBe(1);
      expect(result.routeName).toBe('Test Route');
      expect(result.truckLicensePlate).toBe('ABC123');
    });

    it('should return null when within threshold', async () => {
      const mockRoute = {
        id: 1,
        name: 'Test Route',
        coordinates: [{ latitude: 0, longitude: 0 }],
        deviationThreshold: 100, // 100 meters
        truckId: 1,
      };
      const mockTruck = { id: 1, licensePlate: 'ABC123' };

      mockRouteRepository.findOne.mockResolvedValue(mockRoute);
      mockTruckRepository.findOne.mockResolvedValue(mockTruck);

      // Point ~50m away should be within 100m threshold
      const result = await service.checkDeviation(1, 0, 0.00045);

      expect(result).toBeNull();
    });
  });

  describe('createRoute', () => {
    it('should create route successfully', async () => {
      const mockTruck = { id: 1, licensePlate: 'ABC123' };
      const routeData = {
        name: 'Test Route',
        coordinates: [{ latitude: 0, longitude: 0 }, { latitude: 0.01, longitude: 0.01 }],
        truckId: 1,
      };
      const mockRoute = { id: 1, ...routeData };

      mockTruckRepository.findOne.mockResolvedValue(mockTruck);
      mockRouteRepository.create.mockReturnValue(mockRoute);
      mockRouteRepository.save.mockResolvedValue(mockRoute);

      const result = await service.createRoute(1, routeData);

      expect(result).toEqual(mockRoute);
      expect(mockRouteRepository.create).toHaveBeenCalledWith({
        ...routeData,
        truckId: 1,
        deviationThreshold: 100, // default
      });
    });

    it('should throw error if truck not found', async () => {
      mockTruckRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createRoute(999, {
          name: 'Test Route',
          coordinates: [{ latitude: 0, longitude: 0 }],
          truckId: 999,
        }),
      ).rejects.toThrow('Truck with id 999 not found');
    });
  });
});
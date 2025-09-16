import { Test, TestingModule } from '@nestjs/testing';
import {
  VerificationToken,
  VerificationTokenCreate,
} from './dtos/VerificationToken.dto';
import { VerificationTokenController } from './VerificationToken.controller';
import { VerificationTokenService } from './VerificationToken.service';
import { CrudRequest } from '@nestjsx/crud';

const baseRequest: CrudRequest = {
  parsed: {
    fields: [],
    paramsFilter: [],
    search: {},
    filter: [],
    or: [],
    join: [],
    sort: [],
    authPersist: undefined,
    limit: 10,
    offset: 0,
    page: 1,
    cache: undefined,
  },
  options: {},
};

describe('VerificationTokenController', () => {
  let controller: VerificationTokenController;
  let spyService: VerificationTokenService;

  beforeEach(async () => {
    const ApiServiceProvider = {
      provide: VerificationTokenService,
      useFactory: () => ({
        createOne: jest.fn(() => []),
        getOne: jest.fn(() => {}),
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VerificationTokenController],
      providers: [VerificationTokenService, ApiServiceProvider],
    }).compile();

    controller = module.get<VerificationTokenController>(
      VerificationTokenController,
    );
    spyService = module.get<VerificationTokenService>(VerificationTokenService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call VerificationTokenController get method', () => {
    const req: CrudRequest = { ...baseRequest };
    expect(controller.get(req)).not.toEqual(null);
    expect(spyService.getOne).toHaveBeenCalled();
  });

  it('should call VerificationTokenController create method', () => {
    const req: CrudRequest = { ...baseRequest };

    const dto = new VerificationToken();
    controller.create(req, dto);
    expect(controller.create(req, dto)).not.toEqual(null);
    expect(spyService.createOne).toHaveBeenCalled();
  });

  // Add your tests here
});

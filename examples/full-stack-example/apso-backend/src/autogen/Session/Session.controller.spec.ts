import { Test, TestingModule } from '@nestjs/testing';
import { Session, SessionCreate } from './dtos/Session.dto';
import { SessionController } from './Session.controller';
import { SessionService } from './Session.service';
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

describe('SessionController', () => {
  let controller: SessionController;
  let spyService: SessionService;

  beforeEach(async () => {
    const ApiServiceProvider = {
      provide: SessionService,
      useFactory: () => ({
        createOne: jest.fn(() => []),
        getOne: jest.fn(() => {}),
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [SessionService, ApiServiceProvider],
    }).compile();

    controller = module.get<SessionController>(SessionController);
    spyService = module.get<SessionService>(SessionService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call SessionController get method', () => {
    const req: CrudRequest = { ...baseRequest };
    expect(controller.get(req)).not.toEqual(null);
    expect(spyService.getOne).toHaveBeenCalled();
  });

  it('should call SessionController create method', () => {
    const req: CrudRequest = { ...baseRequest };

    const dto = new Session();
    controller.create(req, dto);
    expect(controller.create(req, dto)).not.toEqual(null);
    expect(spyService.createOne).toHaveBeenCalled();
  });

  // Add your tests here
});

import { Test, TestingModule } from '@nestjs/testing';
import { User, UserCreate } from './dtos/User.dto';
import { UserController } from './User.controller';
import { UserService } from './User.service';
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

describe('UserController', () => {
  let controller: UserController;
  let spyService: UserService;

  beforeEach(async () => {
    const ApiServiceProvider = {
      provide: UserService,
      useFactory: () => ({
        createOne: jest.fn(() => []),
        getOne: jest.fn(() => {}),
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [UserService, ApiServiceProvider],
    }).compile();

    controller = module.get<UserController>(UserController);
    spyService = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call UserController get method', () => {
    const req: CrudRequest = { ...baseRequest };
    expect(controller.get(req)).not.toEqual(null);
    expect(spyService.getOne).toHaveBeenCalled();
  });

  it('should call UserController create method', () => {
    const req: CrudRequest = { ...baseRequest };

    const dto = new User();
    controller.create(req, dto);
    expect(controller.create(req, dto)).not.toEqual(null);
    expect(spyService.createOne).toHaveBeenCalled();
  });

  // Add your tests here
});

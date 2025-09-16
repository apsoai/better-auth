import { Test, TestingModule } from '@nestjs/testing';
import { Account, AccountCreate } from './dtos/Account.dto';
import { AccountController } from './Account.controller';
import { AccountService } from './Account.service';
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

describe('AccountController', () => {
  let controller: AccountController;
  let spyService: AccountService;

  beforeEach(async () => {
    const ApiServiceProvider = {
      provide: AccountService,
      useFactory: () => ({
        createOne: jest.fn(() => []),
        getOne: jest.fn(() => {}),
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountController],
      providers: [AccountService, ApiServiceProvider],
    }).compile();

    controller = module.get<AccountController>(AccountController);
    spyService = module.get<AccountService>(AccountService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call AccountController get method', () => {
    const req: CrudRequest = { ...baseRequest };
    expect(controller.get(req)).not.toEqual(null);
    expect(spyService.getOne).toHaveBeenCalled();
  });

  it('should call AccountController create method', () => {
    const req: CrudRequest = { ...baseRequest };

    const dto = new Account();
    controller.create(req, dto);
    expect(controller.create(req, dto)).not.toEqual(null);
    expect(spyService.createOne).toHaveBeenCalled();
  });

  // Add your tests here
});

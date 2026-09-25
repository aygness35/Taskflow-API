import { validateSync } from 'class-validator';
import { VersionDto } from './version.dto';
import { CreateTaskDto } from '../tasks/dto/task.dto';

describe('Calendar timestamps', () => {
  it.each([
    '2099-W01-1',
    '2099-001',
    '2099-01-01',
    '2099-01-01T12:00:00',
    '2099-02-30T00:00:00Z',
    '2099-01-01T00:00:00.1234Z',
    null,
    42,
  ])('rejects %s before Date conversion', (value) => {
    expect(
      validateSync(
        Object.assign(new VersionDto(), { expectedUpdatedAt: value }),
      ),
    ).not.toHaveLength(0);
    expect(
      validateSync(
        Object.assign(new CreateTaskDto(), {
          title: 'Valid title',
          dueDate: value === null ? 42 : value,
        }),
      ),
    ).not.toHaveLength(0);
  });
  it.each([
    '2099-01-01T00:00:00Z',
    '2099-01-01T00:00:00.123Z',
    '2099-01-01T03:00:00+03:00',
  ])('accepts %s', (value) => {
    expect(
      validateSync(
        Object.assign(new VersionDto(), { expectedUpdatedAt: value }),
      ),
    ).toHaveLength(0);
  });
  it('requires versions and preserves nullable deadlines', () => {
    expect(validateSync(new VersionDto())).not.toHaveLength(0);
    expect(
      validateSync(
        Object.assign(new CreateTaskDto(), {
          title: 'Valid title',
          dueDate: null,
        }),
      ),
    ).toHaveLength(0);
  });
});

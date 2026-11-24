// Typed errors. Each has a stable `code` so callers can branch without parsing messages.

export class RegionalError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

/** The input is not a real date, or not in the expected format. */
export class InvalidDateError extends RegionalError {
  constructor(message: string) {
    super('invalid_date', message);
  }
}

/** The date is outside the range the bundled or loaded release covers. */
export class OutOfRangeError extends RegionalError {
  readonly range: { from: string; to: string };
  constructor(message: string, range: { from: string; to: string }) {
    super('out_of_range', `${message} (release covers ${range.from} to ${range.to})`);
    this.range = range;
  }
}

/** No administrative unit with that code, or none valid on the requested date. */
export class UnknownUnitError extends RegionalError {
  constructor(message: string) {
    super('unknown_unit', message);
  }
}

/** The release file is for another dataset or an unsupported schema version. */
export class UnsupportedReleaseError extends RegionalError {
  constructor(message: string) {
    super('unsupported_release', message);
  }
}

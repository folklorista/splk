export interface AppEnvironment {
  /** base URL of the shared API including the version prefix */
  apiBaseUrl: string;
  /** http = real API, mock = in-memory adapters for work without a server */
  dataSource: 'http' | 'mock';
}

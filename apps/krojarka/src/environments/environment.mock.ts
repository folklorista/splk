import { AppEnvironment } from './app-environment';

/** No server: in-memory mock adapters (npm start -- --configuration mock). */
export const environment: AppEnvironment = {
  apiBaseUrl: 'http://localhost:8082/v1',
  dataSource: 'mock',
};

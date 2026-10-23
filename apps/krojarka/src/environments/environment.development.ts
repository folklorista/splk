import { AppEnvironment } from './app-environment';

/** Local Docker API (docker compose up api). */
export const environment: AppEnvironment = {
  apiBaseUrl: 'http://localhost:8082/v1',
  dataSource: 'http',
};

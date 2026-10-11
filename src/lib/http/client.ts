import axios from 'axios';
import { publicConfig } from '@/config/public';

export const http = axios.create({
  baseURL: publicConfig.apiUrl,
  withCredentials: true,
  timeout: 15000,
  headers: { Accept: 'application/json' },
  // Handle HTTP statuses at the validated boundary; never retain an Axios error
  // containing a password or Google credential in UI state.
  validateStatus: () => true,
});

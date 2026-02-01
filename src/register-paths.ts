import path from 'node:path';
import { register } from 'tsconfig-paths';

// At runtime we run compiled JS from dist; map "@/*" to dist files.
const baseUrl = path.resolve(__dirname); // dist/
register({
  baseUrl,
  paths: {
    '@/*': ['*'],
  },
});

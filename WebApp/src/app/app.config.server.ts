import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, ɵSERVER_CONTEXT } from '@angular/platform-server';
import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    { provide: ɵSERVER_CONTEXT, useValue: 'ssr' }
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);

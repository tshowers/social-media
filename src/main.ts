import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig, appReady } from './app/app.config';
import { AppComponent } from './app/app.component';

appReady
  .then(() => bootstrapApplication(AppComponent, appConfig))
  .catch((err) => console.error(err));

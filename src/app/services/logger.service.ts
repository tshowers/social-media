import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LoggerService {

  production = environment.production;

  log(message: any, ...optionalParams: any[]) {
    if (!this.production) {
      console.log(message, ...optionalParams);
    }
  }

  error(message: any, ...optionalParams: any[]) {
      console.error(message, ...optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
      console.warn(message, ...optionalParams);
  }

  info(message: any, ...optionalParams: any[]) {
    if (!this.production) {
      console.info(message, ...optionalParams);
    }
  }

  debug(message: any, ...optionalParams: any[]) {
    if (!this.production) {
      console.debug(message, ...optionalParams);
    }
  }
}

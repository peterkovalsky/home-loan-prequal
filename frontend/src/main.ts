import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { createAppConfig } from './app/app.config';
import { loadAppConfig } from './app/core/config/app-config';

loadAppConfig()
	.then((config) => bootstrapApplication(AppComponent, createAppConfig(config)))
	.catch((err) => {
		console.error(err);
		document.body.textContent = 'Sorry, the application could not start. Please try again later.';
	});

/**
 * =====================================================================
 * EXPORT GUIDE: CHRONOTACTICS BACKEND
 * =====================================================================
 * 
 * To make the Apple Calendar Sync work for real, you need to set up a 
 * NestJS backend.
 * 
 * 1. Initialize NestJS:
 *    $ npm i -g @nestjs/cli
 *    $ nest new chrono-backend
 *    $ cd chrono-backend
 *    $ npm install dav ical.js dotenv
 * 
 * 2. Create .env file:
 *    ICLOUD_EMAIL=anishagarwal.inbox@gmail.com
 *    ICLOUD_PASSWORD=dhgo-nvjz-cevz-wejp
 * 
 * 3. Copy the code blocks below into your src/ folder.
 */

export const NESTJS_CONTROLLER_CODE = `
import { Controller, Get, Logger } from '@nestjs/common';
import { ICloudService } from './icloud.service';

@Controller('api/calendar')
export class CalendarController {
  constructor(private readonly cloudService: ICloudService) {}

  @Get('sync')
  async syncCalendar() {
    Logger.log('Sync request received', 'CalendarController');
    return await this.cloudService.syncEvents();
  }
}
`;

export const NESTJS_SERVICE_CODE = `
import { Injectable, Logger } from '@nestjs/common';
import { dav } from 'dav';
import * as ICAL from 'ical.js';

@Injectable()
export class ICloudService {
  private readonly logger = new Logger(ICloudService.name);
  
  // In real app, use ConfigService
  private readonly email = process.env.ICLOUD_EMAIL;
  private readonly password = process.env.ICLOUD_PASSWORD;
  private readonly calDavUrl = 'https://caldav.icloud.com';

  async syncEvents(): Promise<any[]> {
    try {
      this.logger.log('Initializing iCloud Connection...');

      const xhr = new dav.Transport({
        email: this.email,
        password: this.password,
        useSSL: true,
      });

      // Auto-Discovery of Principal URL
      const account = await dav.createAccount({
        server: this.calDavUrl,
        xhr: xhr,
        loadObjects: false,
      });

      this.logger.log(\`Connected. Principal: \${account.principalUrl}\`);

      // Find 'Home' or 'Calendar'
      // Adjust this filter based on what you see in account.calendars
      const primaryCalendar = account.calendars.find(c => 
        c.displayName === 'Home' || c.displayName === 'Calendar' || c.displayName === 'Work'
      );

      if (!primaryCalendar) {
        this.logger.error('Available Calendars:', account.calendars.map(c => c.displayName));
        throw new Error('Primary calendar not found');
      }

      this.logger.log(\`Fetching events from: \${primaryCalendar.displayName}\`);

      // Sync Objects
      const calendarObjects = await dav.syncCalendar(primaryCalendar, { xhr });
      
      // Parse to our TacticalUnit format directly or return raw events
      const events = calendarObjects.map(obj => {
        const jcal = ICAL.parse(obj.data);
        const comp = new ICAL.Component(jcal);
        const vevent = comp.getFirstSubcomponent('vevent');
        
        return {
          uid: vevent.getFirstPropertyValue('uid'),
          summary: vevent.getFirstPropertyValue('summary'),
          start: vevent.getFirstPropertyValue('dtstart').toJSDate(),
          end: vevent.getFirstPropertyValue('dtend').toJSDate(),
          rrule: vevent.getFirstPropertyValue('rrule'), 
        };
      });

      return events;

    } catch (error) {
      this.logger.error('iCloud Sync Failed', error);
      throw error;
    }
  }
}
`;

export const NESTJS_MODULE_CODE = `
import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { ICloudService } from './icloud.service';

@Module({
  controllers: [CalendarController],
  providers: [ICloudService],
})
export class CalendarModule {}
`;

export const MAIN_TS_CORS_UPDATE = `
// In your main.ts, ensure CORS is enabled for your frontend
app.enableCors({
  origin: ['http://localhost:5173', 'http://localhost:3001'], // Your frontend URL
});
`;

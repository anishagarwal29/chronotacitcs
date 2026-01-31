import type { VercelRequest, VercelResponse } from '@vercel/node';
import { dav } from 'dav';
import * as ICAL from 'ical.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS Handling
    res.setHeader('Access-Control-Allow-Credentials', "true");
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const email = process.env.ICLOUD_EMAIL;
    const password = process.env.ICLOUD_PASSWORD;

    if (!email || !password) {
        return res.status(500).json({ error: 'Missing Server Configuration (ICLOUD_EMAIL/PASSWORD)' });
    }

    try {
        const xhr = new dav.Transport({
            email,
            password,
            useSSL: true,
        });

        const account = await dav.createAccount({
            server: 'https://caldav.icloud.com',
            xhr: xhr,
            loadObjects: false,
        });

        // Find a calendar to use (Home, Calendar, or Work)
        const primaryCalendar = account.calendars.find((c: any) =>
            ['Home', 'Calendar', 'Work'].includes(c.displayName)
        );

        if (!primaryCalendar) {
            // Fallback: use first one if none of the common names exist
            const first = account.calendars[0];
            if (!first) throw new Error("No calendars found");

            await dav.syncCalendar(first, { xhr });
        } else {
            await dav.syncCalendar(primaryCalendar, { xhr });
        }

        // The library modifies the calendar object in place or returns objects
        // Let's re-fetch objects from the calendar we just synced
        const targetCalendar = primaryCalendar || account.calendars[0];

        // Filter for recent events (simplification: simple map)
        const events = targetCalendar.objects.map((obj: any) => {
            try {
                const jcal = ICAL.parse(obj.data);
                const comp = new ICAL.Component(jcal);
                const vevent = comp.getFirstSubcomponent('vevent');

                if (!vevent) return null;

                return {
                    uid: vevent.getFirstPropertyValue('uid'),
                    summary: vevent.getFirstPropertyValue('summary'),
                    start: vevent.getFirstPropertyValue('dtstart').toJSDate(),
                    end: vevent.getFirstPropertyValue('dtend').toJSDate(),
                    description: vevent.getFirstPropertyValue('description') || "",
                };
            } catch (err) {
                return null;
            }
        }).filter((e: any) => e !== null);

        // Sort by start time
        events.sort((a: any, b: any) => a.start.getTime() - b.start.getTime());

        res.status(200).json(events);

    } catch (error: any) {
        console.error("Sync Error:", error);
        res.status(500).json({ error: error.message || 'Failed to sync with iCloud' });
    }
}

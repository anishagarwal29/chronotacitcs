import type { VercelRequest, VercelResponse } from '@vercel/node';
import ICAL from 'ical.js';

/**
 * Serverless function to sync with iCloud Calendar via CalDAV
 * Uses native fetch instead of the dav library for better serverless compatibility
 */
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
        return res.status(500).json({
            error: 'Missing Server Configuration',
            details: 'ICLOUD_EMAIL or ICLOUD_PASSWORD environment variables are not set'
        });
    }

    try {
        // iCloud CalDAV URL structure: https://caldav.icloud.com/{apple-id-prefix}/calendars/
        // For anishagarwal.inbox@gmail.com, we need just the part before @
        const username = email.includes('@icloud.com') ? email.split('@')[0] : email.split('@')[0];

        // Try the home calendar first (most common)
        const calendarUrl = `https://caldav.icloud.com/${username}/calendars/home/`;

        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - 1);
        const endDate = new Date(now);
        endDate.setDate(now.getDate() + 7);

        const reportBody = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z" 
                      end="${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

        const authHeader = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');

        console.log('Attempting CalDAV request to:', calendarUrl);

        const response = await fetch(calendarUrl, {
            method: 'REPORT',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/xml; charset=utf-8',
                'Depth': '1'
            },
            body: reportBody
        });

        console.log('CalDAV response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('CalDAV error response:', errorText);
            throw new Error(`CalDAV request failed: ${response.status} ${response.statusText}`);
        }

        const xmlText = await response.text();
        console.log('Received XML response, length:', xmlText.length);

        // Parse the XML response to extract calendar data
        const calendarDataMatches = xmlText.match(/<C:calendar-data>([\s\S]*?)<\/C:calendar-data>/g);

        if (!calendarDataMatches || calendarDataMatches.length === 0) {
            console.log('No calendar events found in response');
            return res.status(200).json([]);
        }

        console.log('Found', calendarDataMatches.length, 'calendar events');

        const events = calendarDataMatches.map(match => {
            try {
                const icsData = match.replace(/<\/?C:calendar-data>/g, '').trim();
                const jcal = ICAL.parse(icsData);
                const comp = new ICAL.Component(jcal);
                const vevent = comp.getFirstSubcomponent('vevent');

                if (!vevent) return null;

                const dtstart = vevent.getFirstPropertyValue('dtstart');
                const dtend = vevent.getFirstPropertyValue('dtend');

                return {
                    uid: vevent.getFirstPropertyValue('uid'),
                    summary: vevent.getFirstPropertyValue('summary') || 'Untitled Event',
                    start: (dtstart && typeof dtstart === 'object' && 'toJSDate' in dtstart) ? dtstart.toJSDate() : new Date(),
                    end: (dtend && typeof dtend === 'object' && 'toJSDate' in dtend) ? dtend.toJSDate() : new Date(),
                    description: vevent.getFirstPropertyValue('description') || '',
                    isRecurring: vevent.hasProperty('rrule')
                };
            } catch (err) {
                console.error('Error parsing event:', err);
                return null;
            }
        }).filter((e): e is NonNullable<typeof e> => e !== null);

        events.sort((a, b) => a.start.getTime() - b.start.getTime());

        console.log('Returning', events.length, 'parsed events');
        res.status(200).json(events);

    } catch (error: any) {
        console.error("Sync Error:", error);
        res.status(500).json({
            error: 'Failed to sync with iCloud',
            details: error.message,
            stack: error.stack
        });
    }
}

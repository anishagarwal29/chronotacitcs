import type { VercelRequest, VercelResponse } from '@vercel/node';
import ICAL from 'ical.js';

/**
 * Serverless function to sync with iCloud Calendar via CalDAV
 * Implements proper CalDAV discovery flow
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
    const authHeader = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');

    // Step 1: Discover current-user-principal
    console.log('Step 1: Discovering user principal...');
    const principalUrl = 'https://caldav.icloud.com/';

    const userPrincipalBody = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal />
  </d:prop>
</d:propfind>`;

    const userPrincipalResponse = await fetch(principalUrl, {
      method: 'PROPFIND',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/xml; charset=utf-8',
        'Depth': '0'
      },
      body: userPrincipalBody
    });

    if (!userPrincipalResponse.ok) {
      throw new Error(`User principal discovery failed: ${userPrincipalResponse.status}`);
    }

    const userPrincipalXml = await userPrincipalResponse.text();
    console.log('User principal response received');

    // Extract current-user-principal URL
    const principalMatch = userPrincipalXml.match(/<current-user-principal[^>]*>[\s\S]*?<href[^>]*>([^<]+)<\/href>/i);

    if (!principalMatch) {
      throw new Error('Could not find user principal');
    }

    let userPrincipalUrl = principalMatch[1];
    if (!userPrincipalUrl.startsWith('http')) {
      userPrincipalUrl = 'https://caldav.icloud.com' + userPrincipalUrl;
    }

    console.log('User principal URL:', userPrincipalUrl);

    // Step 2: Discover calendar-home-set from user principal
    console.log('Step 2: Discovering calendar home...');
    const calendarHomeBody = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-home-set />
  </d:prop>
</d:propfind>`;

    const calendarHomeResponse = await fetch(userPrincipalUrl, {
      method: 'PROPFIND',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/xml; charset=utf-8',
        'Depth': '0'
      },
      body: calendarHomeBody
    });

    if (!calendarHomeResponse.ok) {
      throw new Error(`Calendar home discovery failed: ${calendarHomeResponse.status}`);
    }

    const calendarHomeXml = await calendarHomeResponse.text();
    console.log('Calendar home response received');

    // Extract calendar-home-set URL
    const calendarHomeMatch = calendarHomeXml.match(/<calendar-home-set[^>]*>[\s\S]*?<href[^>]*>([^<]+)<\/href>/i);

    let calendarHomeUrl: string;
    if (!calendarHomeMatch) {
      // Fallback to constructed URL
      const username = email.split('@')[0];
      calendarHomeUrl = `https://caldav.icloud.com/${username}/calendars/`;
    } else {
      calendarHomeUrl = calendarHomeMatch[1];
      if (!calendarHomeUrl.startsWith('http')) {
        calendarHomeUrl = 'https://caldav.icloud.com' + calendarHomeUrl;
      }
    }

    console.log('Calendar home URL:', calendarHomeUrl);

    // Step 3: Get list of calendars
    console.log('Step 3: Fetching calendar list...');
    const calendarListBody = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname />
    <d:resourcetype />
  </d:prop>
</d:propfind>`;

    const calendarListResponse = await fetch(calendarHomeUrl, {
      method: 'PROPFIND',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/xml; charset=utf-8',
        'Depth': '1'
      },
      body: calendarListBody
    });

    if (!calendarListResponse.ok) {
      throw new Error(`Calendar list fetch failed: ${calendarListResponse.status}`);
    }

    const calendarListXml = await calendarListResponse.text();

    // Find ALL calendar URLs (not just the first one)
    const calendarMatches = calendarListXml.matchAll(/<response[^>]*>([\s\S]*?)<\/response>/gi);
    const calendarUrls: string[] = [];

    for (const match of calendarMatches) {
      const responseBlock = match[1];
      if (responseBlock.includes('<calendar') || responseBlock.includes('<C:calendar')) {
        const hrefMatch = responseBlock.match(/<href[^>]*>([^<]+)<\/href>/i);
        if (hrefMatch) {
          let url = hrefMatch[1];
          if (!url.startsWith('http')) {
            url = 'https://caldav.icloud.com' + url;
          }
          calendarUrls.push(url);
        }
      }
    }

    if (calendarUrls.length === 0) {
      throw new Error('No calendars found');
    }

    console.log(`Found ${calendarUrls.length} calendars`);

    // Step 4: Fetch events from ALL calendars
    console.log('Step 4: Fetching events from all calendars...');
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 30); // 30 days ago
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + 30); // 30 days in future

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

    // Fetch events from all calendars in parallel
    const allEvents = [];

    for (const calendarUrl of calendarUrls) {
      console.log('Fetching from calendar:', calendarUrl);

      const response = await fetch(calendarUrl, {
        method: 'REPORT',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/xml; charset=utf-8',
          'Depth': '1'
        },
        body: reportBody
      });

      if (!response.ok) {
        console.warn(`REPORT failed for ${calendarUrl}: ${response.status}`);
        continue; // Skip this calendar and try the next one
      }

      const xmlText = await response.text();
      const calendarDataMatches = xmlText.match(/<C:calendar-data>([\s\S]*?)<\/C:calendar-data>/gi);

      if (!calendarDataMatches || calendarDataMatches.length === 0) {
        console.log(`No events in calendar: ${calendarUrl}`);
        continue;
      }

      console.log(`Found ${calendarDataMatches.length} events in calendar`);

      const events = calendarDataMatches.map(match => {
        try {
          const icsData = match.replace(/<\/?C:calendar-data>/gi, '').trim();
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

      allEvents.push(...events);
    }

    allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

    console.log(`Returning ${allEvents.length} total events from all calendars`);
    res.status(200).json(allEvents);

  } catch (error: any) {
    console.error("Sync Error:", error);
    res.status(500).json({
      error: 'Failed to sync with iCloud',
      details: error.message,
      stack: error.stack
    });
  }
}

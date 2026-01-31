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
    const authHeader = 'Basic ' + Buffer.from(`${ email }:${ password } `).toString('base64');
    
    // Step 1: Discover calendar-home-set using PROPFIND
    console.log('Step 1: Discovering calendar home...');
    const principalUrl = 'https://caldav.icloud.com/';
    
    const propfindBody = `<? xml version = "1.0" encoding = "utf-8" ?>
    <d: propfind xmlns: d = "DAV:" xmlns: c = "urn:ietf:params:xml:ns:caldav" >
        <d: prop >
            <c: calendar - home - set />
                </d:prop>
                </d:propfind>`;

const propfindResponse = await fetch(principalUrl, {
    method: 'PROPFIND',
    headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/xml; charset=utf-8',
        'Depth': '0'
    },
    body: propfindBody
});

if (!propfindResponse.ok) {
    throw new Error(`PROPFIND failed: ${propfindResponse.status} ${propfindResponse.statusText}`);
}

const propfindXml = await propfindResponse.text();
console.log('PROPFIND response received');

// Extract calendar-home-set URL from XML
const calendarHomeMatch = propfindXml.match(/<calendar-home-set[^>]*>[\s\S]*?<href[^>]*>([^<]+)<\/href>/i);

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

// Step 2: Get list of calendars
console.log('Step 2: Fetching calendar list...');
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

// Find first calendar URL (look for <resourcetype> containing <calendar/>)
const calendarMatches = calendarListXml.matchAll(/<response[^>]*>([\s\S]*?)<\/response>/gi);
let targetCalendarUrl: string | null = null;

for (const match of calendarMatches) {
    const responseBlock = match[1];
    if (responseBlock.includes('<calendar') || responseBlock.includes('<C:calendar')) {
        const hrefMatch = responseBlock.match(/<href[^>]*>([^<]+)<\/href>/i);
        if (hrefMatch) {
            targetCalendarUrl = hrefMatch[1];
            if (!targetCalendarUrl.startsWith('http')) {
                targetCalendarUrl = 'https://caldav.icloud.com' + targetCalendarUrl;
            }
            break;
        }
    }
}

if (!targetCalendarUrl) {
    throw new Error('No calendars found');
}

console.log('Target calendar URL:', targetCalendarUrl);

// Step 3: Fetch events from the calendar
console.log('Step 3: Fetching events...');
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

const response = await fetch(targetCalendarUrl, {
    method: 'REPORT',
    headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/xml; charset=utf-8',
        'Depth': '1'
    },
    body: reportBody
});

if (!response.ok) {
    const errorText = await response.text();
    console.error('REPORT error:', errorText);
    throw new Error(`REPORT failed: ${response.status} ${response.statusText}`);
}

const xmlText = await response.text();
const calendarDataMatches = xmlText.match(/<C:calendar-data>([\s\S]*?)<\/C:calendar-data>/gi);

if (!calendarDataMatches || calendarDataMatches.length === 0) {
    console.log('No events found');
    return res.status(200).json([]);
}

console.log('Found', calendarDataMatches.length, 'events');

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

events.sort((a, b) => a.start.getTime() - b.start.getTime());

console.log('Returning', events.length, 'events');
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
